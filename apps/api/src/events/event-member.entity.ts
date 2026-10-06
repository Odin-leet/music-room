import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from './event.entity';

// owner   = created the event
// invited = the owner invited this account explicitly (can vote under license 'invited')
// guest   = joined a public event, or used the invite code (can see; votes only if the license allows)
export const MEMBER_ROLES = ['owner', 'invited', 'guest'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

// One row per (event, user): who belongs to an event and how.
@Entity('event_members')
@Check('CHK_event_members_role', `"role" IN ('owner', 'invited', 'guest')`)
export class EventMember {
  @PrimaryColumn({ type: 'uuid' })
  eventId: string;

  // Indexed for "events I'm a member of".
  @Index()
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 10 })
  role: MemberRole;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
