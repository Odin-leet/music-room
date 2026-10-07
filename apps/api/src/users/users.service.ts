import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UserProfile, UserSummary } from '@music-room/shared';
import { QueryFailedError, Repository } from 'typeorm';
import { FriendsService } from '../friends/friends.service';
import type { UpdateProfileDto } from './dto/profile.dto';
import { profileFor } from './profile-policy';
import { User } from './user.entity';

// Postgres error code for a unique constraint violation.
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly friends: FriendsService,
  ) {}

  async create(data: Pick<User, 'email' | 'displayName' | 'passwordHash'>) {
    if (await this.users.existsBy({ email: data.email })) {
      throw new ConflictException('Email is already registered');
    }

    const user = this.users.create(data);
    try {
      return await this.users.save(user);
    } catch (err) {
      // Two requests can both pass the check above before either saves;
      // the DB's unique constraint is the real guarantee.
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  findByEmail(email: string) {
    return this.users.findOneBy({ email });
  }

  findById(id: string) {
    return this.users.findOneBy({ id });
  }

  // ---------- profile (V.1) ----------

  // Anyone's profile, filtered for whoever is looking (viewerId null = no token).
  async profile(userId: string, viewerId: string | null): Promise<UserProfile> {
    const user = isUuid(userId) ? await this.users.findOneBy({ id: userId }) : null;
    if (!user) throw new NotFoundException('User not found');
    if (!viewerId) return profileFor(user, 'anonymous', null);
    if (viewerId === user.id) return profileFor(user, 'self', null);
    const friendship = await this.friends.state(viewerId, user.id);
    return profileFor(user, friendship === 'friends' ? 'friend' : 'other', friendship);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    if (dto.birthDate) assertBirthDate(dto.birthDate);
    const changes: Partial<User> = {};
    for (const key of [
      'displayName',
      'bio',
      'realName',
      'city',
      'phone',
      'birthDate',
      'musicGenres',
      'musicArtists',
      'musicVisibility',
    ] as const) {
      if (dto[key] !== undefined) (changes as Record<string, unknown>)[key] = dto[key];
    }
    if (Object.keys(changes).length) await this.users.update(userId, changes);
    return this.profile(userId, userId);
  }

  // By display name, public info only. Logged in: yourself is left out.
  async search(q: string, viewerId: string | null): Promise<UserSummary[]> {
    const query = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.displayName', 'u.bio'])
      // Escape LIKE's wildcards: searching "50%" must not match everything.
      .where(`u."displayName" ILIKE :q ESCAPE '\\'`, { q: `%${q.replace(/[\\%_]/g, '\\$&')}%` })
      .orderBy('u."displayName"', 'ASC')
      .limit(20);
    if (viewerId) query.andWhere('u.id <> :viewerId', { viewerId });
    const rows = await query.getMany();
    return rows.map((u) => ({ id: u.id, displayName: u.displayName, bio: u.bio }));
  }
}

// A real calendar date, not in the future, not before 1900.
function assertBirthDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  const valid = !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  if (!valid || value < '1900-01-01' || d.getTime() > Date.now()) {
    throw new BadRequestException(['birthDate must be a real past date (YYYY-MM-DD)']);
  }
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
