import { canParticipate, canView, distanceMeters, type PolicyEvent } from './event-policy';

const base: PolicyEvent = {
  visibility: 'public',
  license: 'open',
  geoLat: null,
  geoLng: null,
  geoRadiusM: null,
  startsAt: null,
  endsAt: null,
};
const now = new Date('2026-10-06T20:00:00Z');

// A geo event at 42 Paris (approx.), 200 m radius, 18:00–23:00 UTC.
const geo: PolicyEvent = {
  ...base,
  license: 'geo',
  geoLat: 48.8966,
  geoLng: 2.3185,
  geoRadiusM: 200,
  startsAt: new Date('2026-10-06T18:00:00Z'),
  endsAt: new Date('2026-10-06T23:00:00Z'),
};
const inside = { lat: 48.8968, lng: 2.3189 }; // ~35 m away
const outside = { lat: 48.9, lng: 2.33 }; // ~900 m away

describe('distanceMeters', () => {
  it('is 0 for the same point', () => {
    expect(distanceMeters(inside, inside)).toBe(0);
  });

  it('matches a known distance (Paris -> London ≈ 344 km)', () => {
    const km = distanceMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 }) / 1000;
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(348);
  });

  it('puts our test points where the tests expect them', () => {
    expect(distanceMeters(inside, { lat: 48.8966, lng: 2.3185 })).toBeLessThan(200);
    expect(distanceMeters(outside, { lat: 48.8966, lng: 2.3185 })).toBeGreaterThan(200);
  });
});

describe('canView', () => {
  it('lets anyone see a public event', () => {
    expect(canView(base, null)).toEqual({ allowed: true });
  });

  it('hides a private event from non-members', () => {
    expect(canView({ visibility: 'private' }, null)).toEqual({ allowed: false, reason: 'not_member' });
  });

  it.each(['owner', 'invited', 'guest'] as const)('shows a private event to a %s', (role) => {
    expect(canView({ visibility: 'private' }, role)).toEqual({ allowed: true });
  });
});

describe('canParticipate', () => {
  describe("license 'open'", () => {
    it('lets anyone who can see a public event vote, even without joining', () => {
      expect(canParticipate(base, null, { now })).toEqual({ allowed: true });
    });

    it('refuses non-members of a private event (they cannot even see it)', () => {
      expect(canParticipate({ ...base, visibility: 'private' }, null, { now })).toEqual({
        allowed: false,
        reason: 'not_member',
      });
    });

    it('lets a guest of a private event vote', () => {
      expect(canParticipate({ ...base, visibility: 'private' }, 'guest', { now })).toEqual({ allowed: true });
    });
  });

  describe("license 'invited'", () => {
    const invited: PolicyEvent = { ...base, license: 'invited' };

    it('lets the owner and invited members vote', () => {
      expect(canParticipate(invited, 'owner', { now })).toEqual({ allowed: true });
      expect(canParticipate(invited, 'invited', { now })).toEqual({ allowed: true });
    });

    it('refuses guests: the invite code gives access, not a vote', () => {
      expect(canParticipate(invited, 'guest', { now })).toEqual({ allowed: false, reason: 'not_invited' });
    });

    it('refuses strangers of a public invite-only event', () => {
      expect(canParticipate(invited, null, { now })).toEqual({ allowed: false, reason: 'not_invited' });
    });
  });

  describe("license 'geo'", () => {
    it('allows inside the area during the window', () => {
      expect(canParticipate(geo, 'guest', { now, location: inside })).toEqual({ allowed: true });
    });

    it('refuses before the start and after the end', () => {
      expect(canParticipate(geo, 'guest', { now: new Date('2026-10-06T17:59:59Z'), location: inside })).toEqual({
        allowed: false,
        reason: 'not_started',
      });
      expect(canParticipate(geo, 'guest', { now: new Date('2026-10-06T23:00:01Z'), location: inside })).toEqual({
        allowed: false,
        reason: 'ended',
      });
    });

    it('allows exactly at the start and end instants', () => {
      expect(canParticipate(geo, 'guest', { now: geo.startsAt!, location: inside }).allowed).toBe(true);
      expect(canParticipate(geo, 'guest', { now: geo.endsAt!, location: inside }).allowed).toBe(true);
    });

    it('requires a location', () => {
      expect(canParticipate(geo, 'guest', { now })).toEqual({ allowed: false, reason: 'location_required' });
      expect(canParticipate(geo, 'guest', { now, location: null })).toEqual({
        allowed: false,
        reason: 'location_required',
      });
    });

    it('refuses outside the radius', () => {
      expect(canParticipate(geo, 'guest', { now, location: outside })).toEqual({
        allowed: false,
        reason: 'outside_area',
      });
    });

    it('still lets the owner run the event from anywhere, any time', () => {
      expect(canParticipate(geo, 'owner', { now: new Date('2030-01-01'), location: null })).toEqual({
        allowed: true,
      });
    });

    it('checks visibility first: a private geo event refuses non-members', () => {
      expect(canParticipate({ ...geo, visibility: 'private' }, null, { now, location: inside })).toEqual({
        allowed: false,
        reason: 'not_member',
      });
    });
  });
});
