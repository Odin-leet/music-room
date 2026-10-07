import type { FriendshipState, ProfileRelation, ProfileVisibility, UserProfile } from '@music-room/shared';
import type { User } from './user.entity';

// Which tiers each kind of viewer may see. The ONLY place this is decided:
// every route that shows a profile goes through profileFor().
//
//               public  friends  private  music
//   anonymous     ✓        —        —     if music is public
//   other         ✓        —        —     if music is public
//   friend        ✓        ✓        —     if music is public or friends
//   self          ✓        ✓        ✓     always
export function canSee(tier: ProfileVisibility, relation: ProfileRelation): boolean {
  if (relation === 'self') return true;
  if (tier === 'public') return true;
  if (tier === 'friends') return relation === 'friend';
  return false; // private
}

type ProfileFields = Pick<
  User,
  | 'id'
  | 'displayName'
  | 'bio'
  | 'realName'
  | 'city'
  | 'phone'
  | 'birthDate'
  | 'musicGenres'
  | 'musicArtists'
  | 'musicVisibility'
>;

export function profileFor(
  user: ProfileFields,
  relation: ProfileRelation,
  friendship: FriendshipState | null,
): UserProfile {
  return {
    id: user.id,
    relation,
    friendship: relation === 'self' || relation === 'anonymous' ? null : friendship,
    public: { displayName: user.displayName, bio: user.bio },
    friendsOnly: canSee('friends', relation) ? { realName: user.realName, city: user.city } : null,
    private: canSee('private', relation) ? { phone: user.phone, birthDate: user.birthDate } : null,
    music: canSee(user.musicVisibility, relation)
      ? { genres: user.musicGenres, artists: user.musicArtists }
      : null,
    musicVisibility: relation === 'self' ? user.musicVisibility : null,
  };
}
