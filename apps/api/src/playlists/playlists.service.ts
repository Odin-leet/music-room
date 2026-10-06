import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PlaylistView } from '@music-room/shared';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { generateInviteCode } from '../common/invite-code';
import type { MemberRole } from '../events/event-member.entity';
import { User } from '../users/user.entity';
import type { CreatePlaylistDto, UpdatePlaylistDto } from './dto/playlist-input.dto';
import { PlaylistMember } from './playlist-member.entity';
import { canEdit, canViewPlaylist } from './playlist-policy';
import { PlaylistTrack } from './playlist-track.entity';
import { Playlist } from './playlist.entity';

const UNIQUE_VIOLATION = '23505';

export type LoadedPlaylist = { playlist: Playlist & { owner: User }; role: MemberRole | null };

// Playlists themselves (create, list, settings, membership). Their tracks
// and ordering live in PlaylistTracksService.
@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist) private readonly playlists: Repository<Playlist>,
    @InjectRepository(PlaylistMember) private readonly members: Repository<PlaylistMember>,
    @InjectRepository(PlaylistTrack) private readonly tracks: Repository<PlaylistTrack>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreatePlaylistDto): Promise<PlaylistView> {
    for (let attempt = 0; ; attempt++) {
      try {
        const id = await this.dataSource.transaction(async (tx) => {
          const playlist = await tx.save(
            tx.create(Playlist, {
              ownerId: userId,
              name: dto.name,
              description: dto.description ?? '',
              visibility: dto.visibility,
              license: dto.license ?? 'open',
              inviteCode: generateInviteCode(),
            }),
          );
          await tx.insert(PlaylistMember, { playlistId: playlist.id, userId, role: 'owner' });
          return playlist.id;
        });
        return this.view(id, userId);
      } catch (err) {
        if (attempt < 3 && isUniqueViolation(err)) continue; // invite-code collision: retry
        throw err;
      }
    }
  }

  // Public playlists + every playlist I'm a member of, most recently edited first.
  async list(userId: string): Promise<PlaylistView[]> {
    const rows = await this.playlists
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.owner', 'owner')
      .leftJoin(PlaylistMember, 'm', 'm."playlistId" = p.id AND m."userId" = :userId', { userId })
      .addSelect('m.role', 'myRole')
      .addSelect((q) => q.select('count(*)::int').from(PlaylistTrack, 't').where('t."playlistId" = p.id'), 'trackCount')
      .where(`p.visibility = 'public' OR m."userId" IS NOT NULL`)
      .orderBy('p.updatedAt', 'DESC')
      .limit(100)
      .getRawAndEntities();
    return rows.entities.map((p, i) => {
      const raw = rows.raw[i] as { myRole: MemberRole | null; trackCount: number };
      return toView(p as Playlist & { owner: User }, raw.myRole, raw.trackCount);
    });
  }

  async view(playlistId: string, userId: string): Promise<PlaylistView> {
    const { playlist, role } = await this.loadVisible(playlistId, userId);
    const trackCount = await this.tracks.countBy({ playlistId });
    return toView(playlist, role, trackCount);
  }

  async update(playlistId: string, userId: string, dto: UpdatePlaylistDto): Promise<PlaylistView> {
    const { playlist } = await this.loadAsOwner(playlistId, userId);
    await this.playlists.update(playlist.id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      ...(dto.license !== undefined && { license: dto.license }),
    });
    return this.view(playlist.id, userId);
  }

  async remove(playlistId: string, userId: string) {
    const { playlist } = await this.loadAsOwner(playlistId, userId);
    await this.playlists.delete(playlist.id); // members and tracks cascade
  }

  async joinPublic(playlistId: string, userId: string): Promise<PlaylistView> {
    const { playlist, role } = await this.loadVisible(playlistId, userId);
    if (playlist.visibility !== 'public') throw new NotFoundException('Playlist not found');
    if (!role) await this.addMember(playlist.id, userId, 'guest');
    return this.view(playlist.id, userId);
  }

  async joinByCode(inviteCode: string, userId: string): Promise<PlaylistView> {
    const playlist = await this.playlists.findOneBy({ inviteCode });
    if (!playlist) throw new NotFoundException('No playlist with this code');
    await this.addMember(playlist.id, userId, 'guest');
    return this.view(playlist.id, userId);
  }

  async invite(playlistId: string, ownerId: string, email: string) {
    const { playlist } = await this.loadAsOwner(playlistId, ownerId);
    const invitee = await this.users.findOneBy({ email });
    if (!invitee) throw new NotFoundException('No Music Room account with this email');
    if (invitee.id === ownerId) throw new BadRequestException('You already own this playlist');
    await this.members
      .createQueryBuilder()
      .insert()
      .values({ playlistId: playlist.id, userId: invitee.id, role: 'invited' })
      .orUpdate(['role'], ['playlistId', 'userId'])
      .execute();
    return { invited: { id: invitee.id, displayName: invitee.displayName } };
  }

  // ---------- helpers (also used by PlaylistTracksService) ----------

  // The playlist + my role, or 404 if I can't see it (404 rather than 403 so
  // a private playlist's existence isn't revealed).
  async loadVisible(playlistId: string, userId: string): Promise<LoadedPlaylist> {
    const playlist = isUuid(playlistId)
      ? await this.playlists.findOne({ where: { id: playlistId }, relations: { owner: true } })
      : null;
    if (!playlist) throw new NotFoundException('Playlist not found');
    const member = await this.members.findOneBy({ playlistId, userId });
    const role = member?.role ?? null;
    if (!canViewPlaylist(playlist, role).allowed) throw new NotFoundException('Playlist not found');
    return { playlist: playlist as Playlist & { owner: User }, role };
  }

  async canUserView(playlistId: string, userId: string): Promise<boolean> {
    try {
      await this.loadVisible(playlistId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async loadAsOwner(playlistId: string, userId: string): Promise<LoadedPlaylist> {
    const loaded = await this.loadVisible(playlistId, userId);
    if (loaded.role !== 'owner') throw new ForbiddenException('Only the playlist owner can do this');
    return loaded;
  }

  private async addMember(playlistId: string, userId: string, role: MemberRole) {
    await this.members.createQueryBuilder().insert().values({ playlistId, userId, role }).orIgnore().execute();
  }
}

function toView(playlist: Playlist & { owner: User }, role: MemberRole | null, trackCount: number): PlaylistView {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    visibility: playlist.visibility,
    license: playlist.license,
    owner: { id: playlist.owner.id, displayName: playlist.owner.displayName },
    myRole: role,
    inviteCode: role ? playlist.inviteCode : null,
    canEdit: canEdit(playlist, role),
    trackCount,
    createdAt: playlist.createdAt.toISOString(),
    updatedAt: playlist.updatedAt.toISOString(),
  };
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const isUniqueViolation = (err: unknown) =>
  err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION;
