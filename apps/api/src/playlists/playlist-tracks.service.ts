import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PlaylistTrackView, PlaylistTracksView } from '@music-room/shared';
import { QueryFailedError, Repository } from 'typeorm';
import { DeezerService } from '../music/deezer.service';
import type { User } from '../users/user.entity';
import { canEdit } from './playlist-policy';
import { PlaylistTrack } from './playlist-track.entity';
import { PlaylistsBus } from './playlists-bus';
import { PlaylistsService } from './playlists.service';
import { keyBetween, randomKeyBetween } from './positions';

const UNIQUE_VIOLATION = '23505';
// Enough for a burst of simultaneous edits in the same gap (each retry
// re-reads the neighbours and picks a random spot, so collisions die out fast).
const MAX_ATTEMPTS = 10;

// Where a track should go: right after `afterId`, at the top (null), or at
// the end (undefined — only for adds).
type Placement = string | null | undefined;

// Playlist tracks: add, move, remove — without locks.
// Every change is ONE single-row INSERT or UPDATE, its position computed
// from the neighbours as they are in the database right now. Two people
// changing different tracks touch different rows, so nothing has to wait.
// The only conflict left — two people creating the exact same key in the
// same gap at the same instant — is caught by the unique index on
// (playlistId, position): we re-read the neighbours and try again.
@Injectable()
export class PlaylistTracksService {
  constructor(
    private readonly playlists: PlaylistsService,
    private readonly deezer: DeezerService,
    private readonly bus: PlaylistsBus,
    @InjectRepository(PlaylistTrack) private readonly tracks: Repository<PlaylistTrack>,
  ) {}

  async list(playlistId: string, userId: string): Promise<PlaylistTracksView> {
    await this.playlists.loadVisible(playlistId, userId);
    const rows = await this.tracks.find({
      where: { playlistId },
      relations: { addedBy: true },
      order: { position: 'ASC', id: 'ASC' },
    });
    return { playlistId, tracks: rows.map(toView) };
  }

  async add(playlistId: string, userId: string, providerTrackId: string, afterId: Placement) {
    await this.requireEdit(playlistId, userId);
    const t = await this.deezer.track(providerTrackId);

    const saved = await this.withRetry(async (attempt) => {
      const position = await this.positionFor(playlistId, afterId, null, attempt);
      return this.tracks.save(
        this.tracks.create({
          playlistId,
          position,
          provider: t.provider,
          providerTrackId: t.providerTrackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          coverUrl: t.coverUrl,
          durationSec: t.durationSec,
          isrc: t.isrc,
          addedById: userId,
        }),
      );
    });
    const track = toView(await this.tracks.findOneOrFail({ where: { id: saved.id }, relations: { addedBy: true } }));
    this.bus.publish('track.added', { playlistId, track });
    return track;
  }

  async move(playlistId: string, trackId: string, userId: string, afterId: string | null) {
    await this.requireEdit(playlistId, userId);
    if (afterId === trackId) throw new BadRequestException('A track cannot be placed after itself');
    await this.requireTrack(playlistId, trackId);

    const position = await this.withRetry(async (attempt) => {
      const key = await this.positionFor(playlistId, afterId, trackId, attempt);
      const { affected } = await this.tracks.update({ id: trackId, playlistId }, { position: key });
      // Removed by someone else between our check and this update.
      if (!affected) throw new NotFoundException('Track not found in this playlist');
      return key;
    });
    this.bus.publish('track.moved', { playlistId, trackId, position });
    return toView(await this.tracks.findOneOrFail({ where: { id: trackId }, relations: { addedBy: true } }));
  }

  // Idempotent: removing a track that's already gone is fine.
  async remove(playlistId: string, trackId: string, userId: string) {
    await this.requireEdit(playlistId, userId);
    if (!isUuid(trackId)) return;
    const { affected } = await this.tracks.delete({ id: trackId, playlistId });
    // Only the request that actually removed it announces it.
    if (affected) this.bus.publish('track.removed', { playlistId, trackId });
  }

  // ---------- helpers ----------

  // The key for "right after `afterId`" (or top / end), from the neighbours
  // in the database now. `moving` is excluded: a track is never its own neighbour.
  // First attempt: the clean middle key; retries: a random spot in the gap.
  private async positionFor(playlistId: string, afterId: Placement, moving: string | null, attempt: number) {
    const between = attempt === 0 ? keyBetween : randomKeyBetween;
    const others = () => {
      const q = this.tracks.createQueryBuilder('t').where('t."playlistId" = :playlistId', { playlistId });
      return moving ? q.andWhere('t.id <> :moving', { moving }) : q;
    };

    if (afterId === undefined) {
      const last = await others().orderBy('t.position', 'DESC').getOne();
      return between(last?.position ?? null, null);
    }
    if (afterId === null) {
      const first = await others().orderBy('t.position', 'ASC').getOne();
      return between(null, first?.position ?? null);
    }
    const anchor = isUuid(afterId) ? await this.tracks.findOneBy({ id: afterId, playlistId }) : null;
    // The track we were asked to go after has just been removed (or moved
    // out of this playlist): the app's view is stale, it should reload.
    if (!anchor) throw new ConflictException('The track to place it after is no longer in the playlist');
    // `>` uses the column's COLLATE "C", so it agrees with the key order.
    const next = await others()
      .andWhere('t.position > :pos', { pos: anchor.position })
      .orderBy('t.position', 'ASC')
      .getOne();
    return between(anchor.position, next?.position ?? null);
  }

  // Runs one write; on a position collision, re-reads and tries again.
  private async withRetry<T>(write: (attempt: number) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await write(attempt);
      } catch (err) {
        const constraint = uniqueConstraintOf(err);
        if (constraint === 'UQ_playlist_tracks_song_once') {
          throw new ConflictException('This song is already in the playlist');
        }
        if (constraint === 'UQ_playlist_tracks_position' && attempt + 1 < MAX_ATTEMPTS) continue;
        throw err;
      }
    }
  }

  private async requireEdit(playlistId: string, userId: string) {
    const { playlist, role } = await this.playlists.loadVisible(playlistId, userId); // 404 if hidden
    const decision = canEdit(playlist, role);
    if (!decision.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Only invited people can edit this playlist',
        reason: decision.reason,
      });
    }
  }

  private async requireTrack(playlistId: string, trackId: string) {
    const track = isUuid(trackId) ? await this.tracks.findOneBy({ id: trackId, playlistId }) : null;
    if (!track) throw new NotFoundException('Track not found in this playlist');
    return track;
  }
}

function toView(t: PlaylistTrack & { addedBy?: User | null }): PlaylistTrackView {
  return {
    id: t.id,
    provider: 'deezer',
    providerTrackId: t.providerTrackId,
    title: t.title,
    artist: t.artist,
    album: t.album,
    coverUrl: t.coverUrl,
    durationSec: t.durationSec,
    isrc: t.isrc,
    position: t.position,
    addedBy: t.addedBy ? { id: t.addedBy.id, displayName: t.addedBy.displayName } : null,
    addedAt: t.addedAt.toISOString(),
  };
}

// Which unique constraint a Postgres error violated, if any.
function uniqueConstraintOf(err: unknown): string | null {
  if (!(err instanceof QueryFailedError)) return null;
  const driver = err.driverError as { code?: string; constraint?: string };
  return driver.code === UNIQUE_VIOLATION ? (driver.constraint ?? null) : null;
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
