import type { EventMember, MemberRole } from './event-member.entity';
import type { Event } from './event.entity';

// Every Track Vote permission decision lives here, as plain functions with
// no database access: the REST endpoints and the realtime gateway both call
// them, so the rules can't drift apart, and they're unit-tested in isolation.

export type PolicyEvent = Pick<
  Event,
  'visibility' | 'license' | 'geoLat' | 'geoLng' | 'geoRadiusM' | 'startsAt' | 'endsAt'
>;

export type Location = { lat: number; lng: number };

export type ParticipationContext = {
  now: Date;
  // Reported by the phone. Untrusted (GPS can be faked): we check it, log it,
  // and rate-limit geo votes — we don't treat it as proof.
  location?: Location | null;
};

export type DenyReason =
  | 'not_member' // private event, and you're not in it
  | 'not_invited' // license 'invited', and the owner didn't invite you
  | 'not_started' // license 'geo', before startsAt
  | 'ended' // license 'geo', after endsAt
  | 'location_required' // license 'geo', no location sent
  | 'outside_area'; // license 'geo', too far from the event

export type Decision = { allowed: true } | { allowed: false; reason: DenyReason };

const allow: Decision = { allowed: true };
const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

// Can this user see the event at all (details, queue, live updates)?
// role = their membership in this event, or null if they have none.
export function canView(event: Pick<PolicyEvent, 'visibility'>, role: MemberRole | null): Decision {
  if (event.visibility === 'public') return allow;
  return role ? allow : deny('not_member');
}

// Can this user vote or suggest a track right now? (Same rule for both.)
export function canParticipate(
  event: PolicyEvent,
  role: MemberRole | null,
  ctx: ParticipationContext,
): Decision {
  const view = canView(event, role);
  if (!view.allowed) return view;

  // The owner can always run their own event, whatever the license.
  if (role === 'owner') return allow;

  switch (event.license) {
    case 'open':
      return allow;

    case 'invited':
      // Having the invite code gives access (guest), not a vote.
      return role === 'invited' ? allow : deny('not_invited');

    case 'geo': {
      // The DB CHECK guarantees these are set when license = 'geo'.
      const { startsAt, endsAt, geoLat, geoLng, geoRadiusM } = event as Required<PolicyEvent>;
      if (ctx.now < startsAt!) return deny('not_started');
      if (ctx.now > endsAt!) return deny('ended');
      if (!ctx.location) return deny('location_required');
      const distance = distanceMeters(ctx.location, { lat: geoLat!, lng: geoLng! });
      return distance <= geoRadiusM! ? allow : deny('outside_area');
    }
  }
}

// Convenience for callers holding the membership row (or null).
export const roleOf = (member: Pick<EventMember, 'role'> | null): MemberRole | null =>
  member?.role ?? null;

// Great-circle distance (haversine formula). Accurate to well under 1% at the
// scale of a party venue — plenty for a radius check.
export function distanceMeters(a: Location, b: Location): number {
  const R = 6_371_000; // mean Earth radius in metres
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
