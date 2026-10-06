import { canEdit, canViewPlaylist, type PolicyPlaylist } from './playlist-policy';

const pub: PolicyPlaylist = { visibility: 'public', license: 'open' };
const priv: PolicyPlaylist = { visibility: 'private', license: 'open' };

describe('canViewPlaylist', () => {
  it('shows public playlists to anyone', () => {
    expect(canViewPlaylist(pub, null)).toEqual({ allowed: true });
  });

  it('hides private playlists from non-members', () => {
    expect(canViewPlaylist(priv, null)).toEqual({ allowed: false, reason: 'not_member' });
  });

  it.each(['owner', 'invited', 'guest'] as const)('shows a private playlist to a %s', (role) => {
    expect(canViewPlaylist(priv, role)).toEqual({ allowed: true });
  });
});

describe('canEdit', () => {
  it("license 'open': anyone who can see it can edit, even without joining", () => {
    expect(canEdit(pub, null)).toEqual({ allowed: true });
    expect(canEdit(priv, 'guest')).toEqual({ allowed: true });
  });

  it('private playlist: non-members cannot edit (they cannot even see it)', () => {
    expect(canEdit(priv, null)).toEqual({ allowed: false, reason: 'not_member' });
  });

  describe("license 'invited'", () => {
    const invited: PolicyPlaylist = { visibility: 'public', license: 'invited' };

    it('lets the owner and invited members edit', () => {
      expect(canEdit(invited, 'owner')).toEqual({ allowed: true });
      expect(canEdit(invited, 'invited')).toEqual({ allowed: true });
    });

    it('refuses guests (the invite code gives access, not editing) and strangers', () => {
      expect(canEdit(invited, 'guest')).toEqual({ allowed: false, reason: 'not_invited' });
      expect(canEdit(invited, null)).toEqual({ allowed: false, reason: 'not_invited' });
    });
  });
});
