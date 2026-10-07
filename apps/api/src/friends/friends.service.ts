import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  FriendRequestsView,
  FriendRequestView,
  FriendshipResult,
  FriendshipState,
  FriendView,
} from '@music-room/shared';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { FriendsBus } from './friends-bus';
import { Friendship, pairOf } from './friendship.entity';

const FOREIGN_KEY_VIOLATION = '23503';

type Row = { id: string; displayName: string; bio: string; at: Date; requesterId: string };

// Friend requests and friendships. One row per pair (see friendship.entity.ts);
// every change is a single SQL statement, so simultaneous requests, accepts
// and cancels need no lock and always leave one consistent row (or none).
@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship) private readonly friendships: Repository<Friendship>,
    private readonly dataSource: DataSource,
    private readonly bus: FriendsBus,
  ) {}

  // Ask `otherId` to be friends. If they had already asked me, this accepts
  // it instead: both people asking = friends. Asking twice changes nothing.
  async request(meId: string, otherId: string): Promise<FriendshipResult> {
    if (meId.toLowerCase() === otherId.toLowerCase()) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }
    const { userAId, userBId } = pairOf(meId, otherId);
    let changed: unknown[];
    try {
      // Two simultaneous INSERTs of the same pair: Postgres makes the second
      // wait for the first, then it takes the ON CONFLICT branch, where the
      // WHERE decides: a pending request from the OTHER person -> accepted.
      // RETURNING gives a row only if one was inserted or updated: asking
      // again (nothing changes) returns none, so nobody is notified.
      changed = await this.dataSource.query(
        `INSERT INTO friendships ("userAId", "userBId", "requesterId", "status")
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT ("userAId", "userBId") DO UPDATE
           SET "status" = 'accepted', "acceptedAt" = now()
           WHERE friendships."status" = 'pending' AND friendships."requesterId" <> EXCLUDED."requesterId"
         RETURNING "status"`,
        [userAId, userBId, meId.toLowerCase()],
      );
    } catch (err) {
      if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
    if (changed.length) this.notify(meId, otherId);
    return { userId: otherId, friendship: await this.state(meId, otherId) };
  }

  // Accept the request `otherId` sent me. Already friends: fine (idempotent).
  async accept(meId: string, otherId: string): Promise<FriendshipResult> {
    const result = await this.friendships
      .createQueryBuilder()
      .update()
      .set({ status: 'accepted', acceptedAt: () => 'now()' })
      .where({ ...pairOf(meId, otherId), status: 'pending', requesterId: otherId.toLowerCase() })
      .execute();
    if (!result.affected && (await this.state(meId, otherId)) !== 'friends') {
      throw new NotFoundException('No friend request from this user');
    }
    if (result.affected) this.notify(meId, otherId);
    return { userId: otherId, friendship: 'friends' };
  }

  // Decline a request I received, or cancel one I sent. Idempotent.
  async dropRequest(meId: string, otherId: string) {
    const { affected } = await this.friendships.delete({ ...pairOf(meId, otherId), status: 'pending' });
    if (affected) this.notify(meId, otherId);
  }

  // Unfriend. Idempotent.
  async unfriend(meId: string, otherId: string) {
    const { affected } = await this.friendships.delete({ ...pairOf(meId, otherId), status: 'accepted' });
    if (affected) this.notify(meId, otherId);
  }

  // Each call above runs one statement outside a transaction: when it
  // returns, the change is committed, so it's safe to announce.
  private notify(meId: string, otherId: string) {
    this.bus.publish('friends.changed', { userIds: [meId.toLowerCase(), otherId.toLowerCase()] });
  }

  async friends(meId: string): Promise<FriendView[]> {
    const rows = await this.rows(meId, 'accepted');
    return rows.map((r) => ({ user: summary(r), since: r.at.toISOString() }));
  }

  async requests(meId: string): Promise<FriendRequestsView> {
    const rows = await this.rows(meId, 'pending');
    const view = (r: Row): FriendRequestView => ({ user: summary(r), at: r.at.toISOString() });
    const me = meId.toLowerCase();
    return {
      incoming: rows.filter((r) => r.requesterId !== me).map(view),
      sent: rows.filter((r) => r.requesterId === me).map(view),
    };
  }

  async state(meId: string, otherId: string): Promise<FriendshipState> {
    const row = await this.friendships.findOneBy(pairOf(meId, otherId));
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friends';
    return row.requesterId === meId.toLowerCase() ? 'request_sent' : 'request_received';
  }

  // My friendships of one status, with the OTHER person of each pair.
  private rows(meId: string, status: 'pending' | 'accepted'): Promise<Row[]> {
    return this.dataSource.query(
      `SELECT u.id, u."displayName", u.bio, f."requesterId",
              ${status === 'accepted' ? 'f."acceptedAt"' : 'f."createdAt"'} AS at
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f."userAId" = $1 THEN f."userBId" ELSE f."userAId" END
        WHERE (f."userAId" = $1 OR f."userBId" = $1) AND f.status = $2
        ORDER BY ${status === 'accepted' ? 'u."displayName"' : 'f."createdAt" DESC'}`,
      [meId.toLowerCase(), status],
    );
  }
}

const summary = (r: Row) => ({ id: r.id, displayName: r.displayName, bio: r.bio });
