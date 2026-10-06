import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  BroadcastTrack,
  ParticipationDenyReason,
  QueueBroadcast,
  QueueTrack,
  QueueView,
  VoteResult,
} from '@music-room/shared';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { DeezerService } from '../music/deezer.service';
import type { User } from '../users/user.entity';
import { canParticipate, type Location } from './event-policy';
import { EventTrack } from './event-track.entity';
import { EventsBus } from './events-bus';
import { EventsService } from './events.service';
import { Vote } from './vote.entity';

const UNIQUE_VIOLATION = '23505';

// What the app shows when you can't vote / suggest.
const DENY_MESSAGES: Record<ParticipationDenyReason, string> = {
  not_member: 'Event not found',
  not_invited: 'Only invited guests can vote in this event',
  not_started: 'Voting has not started yet',
  ended: 'Voting has ended',
  location_required: 'Share your location to vote in this event',
  outside_area: 'You are too far from the event to vote',
};

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly events: EventsService,
    private readonly deezer: DeezerService,
    private readonly dataSource: DataSource,
    @InjectRepository(EventTrack) private readonly tracks: Repository<EventTrack>,
    @InjectRepository(Vote) private readonly votes: Repository<Vote>,
    private readonly bus: EventsBus,
  ) {}

  async queue(eventId: string, userId: string): Promise<QueueView> {
    await this.events.loadVisible(eventId, userId); // 404 if I can't see it

    const rows = await this.rankedRows(eventId);
    const mine = new Set(
      rows.length
        ? (await this.votes.findBy({ userId, eventTrackId: In(rows.map((t) => t.id)) })).map((v) => v.eventTrackId)
        : [],
    );
    const view = rows.map((t) => toQueueTrack(t, mine.has(t.id)));
    return {
      nowPlaying: view.find((t) => t.status === 'playing') ?? null,
      upcoming: view.filter((t) => t.status === 'queued'),
    };
  }

  // The same queue for every listener (no votedByMe): what the realtime
  // gateway broadcasts. Access is checked when a socket joins the room.
  async broadcastView(eventId: string): Promise<QueueBroadcast> {
    const view = (await this.rankedRows(eventId)).map(toBroadcastTrack);
    return {
      eventId,
      nowPlaying: view.find((t) => t.status === 'playing') ?? null,
      upcoming: view.filter((t) => t.status === 'queued'),
    };
  }

  // Suggest a track. Its details come from Deezer, looked up by the server.
  async suggest(eventId: string, userId: string, providerTrackId: string, location: Location | null) {
    await this.requireParticipation(eventId, userId, location);
    const t = await this.deezer.track(providerTrackId);
    try {
      const saved = await this.tracks.save(
        this.tracks.create({
          eventId,
          provider: t.provider,
          providerTrackId: t.providerTrackId,
          title: t.title,
          artist: t.artist,
          album: t.album,
          coverUrl: t.coverUrl,
          durationSec: t.durationSec,
          isrc: t.isrc,
          suggestedById: userId,
        }),
      );
      const withUser = await this.tracks.findOneOrFail({ where: { id: saved.id }, relations: { suggestedBy: true } });
      this.bus.publish('queue.changed', { eventId });
      return toQueueTrack(withUser, false);
    } catch (err) {
      // The partial unique index: this song is already waiting in the queue.
      if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException('This track is already in the queue');
      }
      throw err;
    }
  }

  // One vote per user per track, safe under any amount of concurrency:
  // 1. INSERT … ON CONFLICT DO NOTHING — the (track, user) primary key lets
  //    exactly one of N simultaneous identical votes insert a row.
  // 2. Only if a row was inserted: UPDATE score = score + 1 — an atomic
  //    increment inside the database (Postgres locks the row and applies
  //    concurrent increments one after another). No read-modify-write.
  // Both in one transaction: the vote row and the score never disagree.
  // Voting twice is not an error: it answers the current state (idempotent).
  async vote(eventId: string, trackId: string, userId: string, location: Location | null): Promise<VoteResult> {
    await this.requireParticipation(eventId, userId, location);
    const result = await this.dataSource.transaction(async (tx) => {
      await this.requireQueuedTrack(tx.getRepository(EventTrack), eventId, trackId);

      const inserted = await tx
        .createQueryBuilder()
        .insert()
        .into(Vote)
        .values({ eventTrackId: trackId, userId })
        .orIgnore()
        .returning('"userId"')
        .execute();

      const changed = (inserted.raw as unknown[]).length > 0;
      const score = changed
        ? await this.bump(tx.getRepository(EventTrack), trackId, '+')
        : (await tx.findOneByOrFail(EventTrack, { id: trackId })).score;
      return { result: { trackId, score, votedByMe: true }, changed };
    });
    // After commit, and only if something actually changed.
    if (result.changed) this.bus.publish('queue.changed', { eventId });
    return result.result;
  }

  // Mirror image: DELETE … RETURNING tells us whether a vote really existed;
  // only then score = score - 1.
  async unvote(eventId: string, trackId: string, userId: string, location: Location | null): Promise<VoteResult> {
    await this.requireParticipation(eventId, userId, location);
    const result = await this.dataSource.transaction(async (tx) => {
      await this.requireQueuedTrack(tx.getRepository(EventTrack), eventId, trackId);

      const deleted = await tx
        .createQueryBuilder()
        .delete()
        .from(Vote)
        .where('"eventTrackId" = :trackId AND "userId" = :userId', { trackId, userId })
        .returning('"userId"')
        .execute();

      const changed = (deleted.raw as unknown[]).length > 0;
      const score = changed
        ? await this.bump(tx.getRepository(EventTrack), trackId, '-')
        : (await tx.findOneByOrFail(EventTrack, { id: trackId })).score;
      return { result: { trackId, score, votedByMe: false }, changed };
    });
    if (result.changed) this.bus.publish('queue.changed', { eventId });
    return result.result;
  }

  // ---------- helpers ----------

  private rankedRows(eventId: string) {
    return this.tracks.find({
      where: { eventId, status: In(['queued', 'playing']) },
      relations: { suggestedBy: true },
      // The ranking rule: most votes first; equal votes -> earliest suggestion
      // first; id last only so the order is fully deterministic.
      order: { score: 'DESC', suggestedAt: 'ASC', id: 'ASC' },
    });
  }

  private async requireParticipation(eventId: string, userId: string, location: Location | null) {
    const { event, role } = await this.events.loadVisible(eventId, userId);
    const decision = canParticipate(event, role, { now: new Date(), location });
    if (event.license === 'geo') {
      // Phone-reported location = untrusted: keep a trail of every geo decision.
      this.logger.log(
        `geo ${decision.allowed ? 'allow' : `deny:${decision.reason}`} event=${eventId} user=${userId} ` +
          `loc=${location ? `${location.lat.toFixed(5)},${location.lng.toFixed(5)}` : 'none'}`,
      );
    }
    if (!decision.allowed) {
      // Body carries the machine-readable reason for the app.
      throw new ForbiddenException({ statusCode: 403, message: DENY_MESSAGES[decision.reason], reason: decision.reason });
    }
    return event;
  }

  private async requireQueuedTrack(repo: Repository<EventTrack>, eventId: string, trackId: string) {
    const track = isUuid(trackId) ? await repo.findOneBy({ id: trackId, eventId }) : null;
    if (!track) throw new NotFoundException('Track not found in this event');
    if (track.status !== 'queued') throw new ConflictException('This track is no longer in the queue');
    return track;
  }

  private async bump(repo: Repository<EventTrack>, trackId: string, sign: '+' | '-') {
    const res = await repo
      .createQueryBuilder()
      .update()
      .set({ score: () => `"score" ${sign} 1` })
      .where('id = :trackId', { trackId })
      .returning('score')
      .execute();
    return (res.raw as Array<{ score: number }>)[0].score;
  }
}

function toQueueTrack(t: EventTrack & { suggestedBy?: User | null }, votedByMe: boolean): QueueTrack {
  return { ...toBroadcastTrack(t), votedByMe };
}

function toBroadcastTrack(t: EventTrack & { suggestedBy?: User | null }): BroadcastTrack {
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
    score: t.score,
    status: t.status,
    suggestedBy: t.suggestedBy ? { id: t.suggestedBy.id, displayName: t.suggestedBy.displayName } : null,
    suggestedAt: t.suggestedAt.toISOString(),
  };
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
