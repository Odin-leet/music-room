import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { EventTrack } from './event-track.entity';

// One vote = one row. The primary key (eventTrackId, userId) is what makes
// "one vote per user per track" true under concurrency: two simultaneous
// votes by the same person can't both insert — Postgres refuses the second.
@Entity('votes')
export class Vote {
  @PrimaryColumn({ type: 'uuid' })
  eventTrackId: string;

  // Indexed for "which tracks did I vote for".
  @Index()
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => EventTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventTrackId' })
  eventTrack: EventTrack;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
