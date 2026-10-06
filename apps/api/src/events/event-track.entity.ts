import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';

export const TRACK_STATUSES = ['queued', 'playing', 'played'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

// A track suggested to an event's queue. The metadata is a snapshot the
// server took from the provider — never data sent by the app.
@Entity('event_tracks')
@Check('CHK_event_tracks_status', `"status" IN ('queued', 'playing', 'played')`)
@Check('CHK_event_tracks_score', `"score" >= 0`)
// The same song can't be in the queue twice at once (it can again once played).
@Index('UQ_event_tracks_queued_once', ['eventId', 'provider', 'providerTrackId'], {
  unique: true,
  where: `"status" = 'queued'`,
})
// Serves the ranked queue: WHERE eventId AND status ORDER BY score DESC, suggestedAt.
@Index('IDX_event_tracks_ranking', ['eventId', 'status', 'score', 'suggestedAt'])
export class EventTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ type: 'varchar', length: 64 })
  providerTrackId: string;

  @Column({ type: 'varchar', length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  artist: string;

  @Column({ type: 'varchar', length: 300 })
  album: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'int' })
  durationSec: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isrc: string | null;

  // Kept if the suggester deletes their account: the track stays in the queue.
  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'suggestedById' })
  suggestedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  suggestedById: string | null;

  // Tie-break: at equal score, the earliest suggestion plays first.
  @CreateDateColumn({ type: 'timestamptz' })
  suggestedAt: Date;

  // Number of votes. Only ever changed by an atomic `score = score ± 1` in the
  // same transaction as the vote row itself — never read-modify-write.
  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 10, default: 'queued' })
  status: TrackStatus;
}
