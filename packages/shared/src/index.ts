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
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  publicInfo: Record<string, unknown>;
  musicPreferences: string[];
}

// Event/Track/Vote/Playlist shapes land here once the Track Vote and
// Playlist Editor services are built.
