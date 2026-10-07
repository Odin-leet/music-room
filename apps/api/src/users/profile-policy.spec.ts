import type { ProfileRelation, ProfileVisibility } from '@music-room/shared';
import { canSee, profileFor } from './profile-policy';

const alice = {
  id: 'a',
  displayName: 'Alice',
  bio: 'Loves jazz',
  realName: 'Alice Martin',
  city: 'Lyon',
  phone: '+33 6 00 00 00 00',
  birthDate: '1999-04-01',
  musicGenres: ['jazz' as const, 'soul' as const],
  musicArtists: ['Nina Simone'],
  musicVisibility: 'friends' as ProfileVisibility,
};

const tiers = (relation: ProfileRelation, musicVisibility: ProfileVisibility = 'friends') => {
  const p = profileFor({ ...alice, musicVisibility }, relation, relation === 'friend' ? 'friends' : 'none');
  return { friendsOnly: !!p.friendsOnly, private: !!p.private, music: !!p.music };
};

describe('profile visibility', () => {
  it('shows the public tier to everyone, even without logging in', () => {
    for (const r of ['anonymous', 'other', 'friend', 'self'] as const) {
      expect(profileFor(alice, r, null).public).toEqual({ displayName: 'Alice', bio: 'Loves jazz' });
    }
  });

  it('anonymous and other users see public only (music set to friends)', () => {
    expect(tiers('anonymous')).toEqual({ friendsOnly: false, private: false, music: false });
    expect(tiers('other')).toEqual({ friendsOnly: false, private: false, music: false });
  });

  it('friends also see the friends tier, never the private one', () => {
    expect(tiers('friend')).toEqual({ friendsOnly: true, private: false, music: true });
    expect(profileFor(alice, 'friend', 'friends').friendsOnly).toEqual({ realName: 'Alice Martin', city: 'Lyon' });
  });

  it('you see everything about yourself, including your music setting', () => {
    expect(tiers('self', 'private')).toEqual({ friendsOnly: true, private: true, music: true });
    expect(profileFor(alice, 'self', null).musicVisibility).toBe('friends');
    expect(profileFor(alice, 'friend', 'friends').musicVisibility).toBeNull();
  });

  it('music follows the owner’s choice', () => {
    expect(tiers('anonymous', 'public').music).toBe(true);
    expect(tiers('other', 'friends').music).toBe(false);
    expect(tiers('friend', 'friends').music).toBe(true);
    expect(tiers('friend', 'private').music).toBe(false);
  });

  it('only logged-in strangers and friends get a friendship state', () => {
    expect(profileFor(alice, 'other', 'request_sent').friendship).toBe('request_sent');
    expect(profileFor(alice, 'anonymous', 'none').friendship).toBeNull();
    expect(profileFor(alice, 'self', 'none').friendship).toBeNull();
  });

  it('canSee matrix', () => {
    expect(canSee('private', 'friend')).toBe(false);
    expect(canSee('private', 'self')).toBe(true);
    expect(canSee('friends', 'other')).toBe(false);
    expect(canSee('public', 'anonymous')).toBe(true);
  });
});
