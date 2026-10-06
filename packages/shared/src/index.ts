// Shared TypeScript contracts between apps/api and apps/mobile.
//
// This is the "link" between the two apps: the mobile client imports these
// same types instead of redefining its own guess at what the API returns,
// so a change to a shape is a compile error in the mobile app, not a
// runtime surprise.

// GET /health
export interface HealthResponse {
  status: 'ok';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// GET /users/me — the logged-in user's own account (never includes passwordHash).
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  // False until the user enters the code emailed at registration.
  emailVerified: boolean;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  publicInfo: Record<string, unknown>;
  musicPreferences: string[];
}

// A track from the music provider, as our API returns it. Deliberately has
// no preview URL: Deezer's preview links expire after ~15 minutes, so a
// fresh one is fetched right before playing (GET /music/tracks/:id/preview).
export interface TrackSummary {
  provider: 'deezer';
  providerTrackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string | null;
  durationSec: number;
  // International Standard Recording Code: identifies the same recording
  // across providers, if we ever add another one.
  isrc: string | null;
}

// GET /music/tracks/:providerTrackId/preview
export interface TrackPreview {
  url: string;
  expiresAt: string; // ISO date
}

// Event/Vote/Playlist shapes land here once the Track Vote and
// Playlist Editor services are built.
