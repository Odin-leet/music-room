import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';

export const FRIENDSHIP_STATUSES = ['pending', 'accepted'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

// One row per PAIR of users, whoever asked first: the pair is stored with
// the smaller id first (userA < userB), so "Alice → Bob" and "Bob → Alice"
// are the same primary key. Two people sending each other a request at the
// same instant therefore can't create two rows; the second one finds the
// first and accepts it (friends.service.ts).
@Check('CHK_friendships_order', `"userAId" < "userBId"`)
@Check('CHK_friendships_requester', `"requesterId" IN ("userAId", "userBId")`)
@Check('CHK_friendships_status', `"status" IN ('pending', 'accepted')`)
@Entity('friendships')
export class Friendship {
  @PrimaryColumn('uuid')
  userAId: string;

  // The primary key (userAId, userBId) serves lookups by userAId; this
  // index serves the other side ("who are my friends" looks at both).
  @Index()
  @PrimaryColumn('uuid')
  userBId: string;

  @Column('uuid')
  requesterId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: FriendshipStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userAId' })
  userA?: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userBId' })
  userB?: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requesterId' })
  requester?: User;
}

// The stored order for a pair.
// Postgres orders uuids like their lower-case text, so compare lower-case.
export function pairOf(x: string, y: string): { userAId: string; userBId: string } {
  x = x.toLowerCase();
  y = y.toLowerCase();
  return x < y ? { userAId: x, userBId: y } : { userAId: y, userBId: x };
}
