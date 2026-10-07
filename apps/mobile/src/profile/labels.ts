import type { MusicGenre, ProfileVisibility } from '@music-room/shared';

export const GENRE_LABEL: Record<MusicGenre, string> = {
  pop: 'Pop',
  rap: 'Rap / Hip-hop',
  rock: 'Rock',
  dance: 'Dance',
  rnb: 'R&B',
  alternative: 'Alternative',
  electro: 'Electro',
  folk: 'Folk',
  reggae: 'Reggae',
  jazz: 'Jazz',
  classical: 'Classical',
  metal: 'Metal',
  soul: 'Soul & Funk',
  blues: 'Blues',
  latin: 'Latin',
  african: 'African',
  asian: 'Asian',
  indian: 'Indian',
  brazilian: 'Brazilian',
  soundtracks: 'Films & Games',
  kids: 'Kids',
};

export const VISIBILITY_LABEL: Record<ProfileVisibility, string> = {
  public: 'Everyone',
  friends: 'Friends',
  private: 'Only me',
};

// Shown on each section of "My profile", so it's always clear who sees what.
export const TIER_HINT = {
  public: 'Everyone can see this, even people without an account.',
  friends: 'Only your friends can see this.',
  private: 'Only you can see this.',
  music: {
    public: 'Everyone can see your music taste.',
    friends: 'Only your friends can see your music taste.',
    private: 'Only you can see your music taste.',
  } satisfies Record<ProfileVisibility, string>,
};
