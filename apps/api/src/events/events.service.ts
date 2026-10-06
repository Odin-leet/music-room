import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EventView } from '@music-room/shared';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { generateInviteCode } from '../common/invite-code';
import { User } from '../users/user.entity';
import type { CreateEventDto, UpdateEventDto } from './dto/event-input.dto';
import { EventMember, type MemberRole } from './event-member.entity';
import { canParticipate, canView, type Location } from './event-policy';
import { EventsBus } from './events-bus';
import { Event } from './event.entity';

const UNIQUE_VIOLATION = '23505';

const GEO_KEYS = ['geoLat', 'geoLng', 'geoRadiusM', 'startsAt', 'endsAt'] as const;

type Loaded = { event: Event & { owner: User }; role: MemberRole | null };

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private readonly events: Repository<Event>,
    @InjectRepository(EventMember) private readonly members: Repository<EventMember>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly bus: EventsBus,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<EventView> {
    const license = dto.license ?? 'open';
    const geo = this.geoColumns(license, dto);

    // Retry on the (astronomically rare) invite-code collision.
    for (let attempt = 0; ; attempt++) {
      try {
        const id = await this.dataSource.transaction(async (tx) => {
          const event = await tx.save(
            tx.create(Event, {
              ownerId: userId,
              name: dto.name,
              description: dto.description ?? '',
              visibility: dto.visibility,
              license,
              inviteCode: generateInviteCode(),
              ...geo,
            }),
          );
          await tx.insert(EventMember, { eventId: event.id, userId, role: 'owner' });
          return event.id;
        });
        return this.view(id, userId);
      } catch (err) {
        if (attempt < 3 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  }

  // Public events + every event I'm a member of, newest first.
  async list(userId: string): Promise<EventView[]> {
    const rows = await this.events
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.owner', 'owner')
      .leftJoin(EventMember, 'm', 'm."eventId" = e.id AND m."userId" = :userId', { userId })
      .addSelect('m.role', 'myRole')
      .where(`e.visibility = 'public' OR m."userId" IS NOT NULL`)
      .orderBy('e.createdAt', 'DESC')
      .limit(100)
      .getRawAndEntities();
    return rows.entities.map((event, i) =>
      toView(event as Event & { owner: User }, (rows.raw[i] as { myRole: MemberRole | null }).myRole, {}),
    );
  }

  async view(eventId: string, userId: string, location?: Location | null): Promise<EventView> {
    const { event, role } = await this.loadVisible(eventId, userId);
    return toView(event, role, { location });
  }

  async update(eventId: string, userId: string, dto: UpdateEventDto): Promise<EventView> {
    const { event } = await this.loadAsOwner(eventId, userId);
    const license = dto.license ?? event.license;

    // Geo fields: take what was sent, fall back to the current values, and
    // drop them all if the event is no longer 'geo'.
    const merged = {
      geoLat: dto.geoLat ?? event.geoLat ?? undefined,
      geoLng: dto.geoLng ?? event.geoLng ?? undefined,
      geoRadiusM: dto.geoRadiusM ?? event.geoRadiusM ?? undefined,
      startsAt: dto.startsAt ?? event.startsAt?.toISOString(),
      endsAt: dto.endsAt ?? event.endsAt?.toISOString(),
    };
    // Not (or no longer) geo: any geo field sent is a mistake → 400; clear them.
    // Geo: validate the merged set (all present, start < end).
    const geo = license === 'geo' ? this.geoColumns('geo', merged) : this.geoColumns(license, dto);

    await this.events.update(event.id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      license,
      ...geo,
    });
    this.bus.publish('event.changed', { eventId: event.id });
    return this.view(event.id, userId);
  }

  async remove(eventId: string, userId: string) {
    const { event } = await this.loadAsOwner(eventId, userId);
    await this.events.delete(event.id); // members, tracks, votes cascade
    this.bus.publish('event.deleted', { eventId: event.id });
  }

  // Public events: anyone can join as a guest (no code needed).
  async joinPublic(eventId: string, userId: string): Promise<EventView> {
    const { event, role } = await this.loadVisible(eventId, userId);
    if (event.visibility !== 'public') throw new NotFoundException('Event not found');
    if (!role) await this.addMember(event.id, userId, 'guest');
    return this.view(event.id, userId);
  }

  // Any event, by its code. Never downgrades an existing role.
  async joinByCode(inviteCode: string, userId: string): Promise<EventView> {
    const event = await this.events.findOneBy({ inviteCode });
    if (!event) throw new NotFoundException('No event with this code');
    await this.addMember(event.id, userId, 'guest');
    return this.view(event.id, userId);
  }

  // Owner invites a registered account: it becomes 'invited' (a guest is upgraded).
  async invite(eventId: string, ownerId: string, email: string) {
    const { event } = await this.loadAsOwner(eventId, ownerId);
    const invitee = await this.users.findOneBy({ email });
    if (!invitee) throw new NotFoundException('No Music Room account with this email');
    if (invitee.id === ownerId) throw new BadRequestException('You already own this event');

    // Insert as invited, or upgrade a guest — but never touch the owner row.
    await this.members
      .createQueryBuilder()
      .insert()
      .values({ eventId: event.id, userId: invitee.id, role: 'invited' })
      .orUpdate(['role'], ['eventId', 'userId'])
      .execute();
    // The invitee's participation changed: their app should refetch.
    this.bus.publish('event.changed', { eventId: event.id });
    return { invited: { id: invitee.id, displayName: invitee.displayName } };
  }

  // ---------- helpers ----------

  // The event + my role, or 404 if I'm not allowed to see it. 404 rather than
  // 403 so a private event's existence isn't revealed to outsiders.
  async loadVisible(eventId: string, userId: string): Promise<Loaded> {
    const event = isUuid(eventId)
      ? await this.events.findOne({ where: { id: eventId }, relations: { owner: true } })
      : null;
    if (!event) throw new NotFoundException('Event not found');
    const member = await this.members.findOneBy({ eventId, userId });
    const role = member?.role ?? null;
    if (!canView(event, role).allowed) throw new NotFoundException('Event not found');
    return { event: event as Event & { owner: User }, role };
  }

  // For the realtime gateway: can this user (still) see the event?
  async canUserView(eventId: string, userId: string): Promise<boolean> {
    try {
      await this.loadVisible(eventId, userId);
      return true;
    } catch {
      return false;
    }
  }

  private async loadAsOwner(eventId: string, userId: string): Promise<Loaded> {
    const loaded = await this.loadVisible(eventId, userId);
    if (loaded.role !== 'owner') throw new ForbiddenException('Only the event owner can do this');
    return loaded;
  }

  // Adds the membership if missing; existing roles are left as they are.
  private async addMember(eventId: string, userId: string, role: MemberRole) {
    await this.members
      .createQueryBuilder()
      .insert()
      .values({ eventId, userId, role })
      .orIgnore()
      .execute();
  }

  // Turns DTO geo fields into DB columns, enforcing "all iff geo".
  private geoColumns(
    license: Event['license'],
    src: Partial<Record<(typeof GEO_KEYS)[number], number | string | undefined>>,
  ) {
    const given = GEO_KEYS.filter((k) => src[k] !== undefined && src[k] !== null);
    if (license !== 'geo') {
      if (given.length) {
        throw new BadRequestException(`${given.join(', ')} only applies when license is 'geo'`);
      }
      return nullGeo();
    }
    const missing = GEO_KEYS.filter((k) => !given.includes(k));
    if (missing.length) throw new BadRequestException(`license 'geo' requires ${missing.join(', ')}`);

    const startsAt = new Date(src.startsAt as string);
    const endsAt = new Date(src.endsAt as string);
    if (startsAt >= endsAt) throw new BadRequestException('startsAt must be before endsAt');
    return {
      geoLat: Number(src.geoLat),
      geoLng: Number(src.geoLng),
      geoRadiusM: Number(src.geoRadiusM),
      startsAt,
      endsAt,
    };
  }
}

const nullGeo = () => ({ geoLat: null, geoLng: null, geoRadiusM: null, startsAt: null, endsAt: null });

function toView(
  event: Event & { owner: User },
  role: MemberRole | null,
  { location }: { location?: Location | null },
): EventView {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    visibility: event.visibility,
    license: event.license,
    geo:
      event.license === 'geo'
        ? {
            lat: event.geoLat!,
            lng: event.geoLng!,
            radiusM: event.geoRadiusM!,
            startsAt: event.startsAt!.toISOString(),
            endsAt: event.endsAt!.toISOString(),
          }
        : null,
    owner: { id: event.owner.id, displayName: event.owner.displayName },
    myRole: role,
    inviteCode: role ? event.inviteCode : null,
    participation: canParticipate(event, role, { now: new Date(), location }),
    createdAt: event.createdAt.toISOString(),
  };
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const isUniqueViolation = (err: unknown) =>
  err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION;
