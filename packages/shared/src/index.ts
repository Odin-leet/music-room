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

// ---------- Track Vote ----------

export type EventVisibility = 'public' | 'private';
// open = anyone who can see it · invited = owner + invited accounts only ·
// geo = inside an area during a time window
export type EventLicense = 'open' | 'invited' | 'geo';
export type MemberRole = 'owner' | 'invited' | 'guest';

// Why you can't vote/suggest (or see), so the app can explain it.
export type ParticipationDenyReason =
  | 'not_member'
  | 'not_invited'
  | 'not_started'
  | 'ended'
  | 'location_required'
  | 'outside_area';

export type Participation = { allowed: true } | { allowed: false; reason: ParticipationDenyReason };

export interface EventGeo {
  lat: number;
  lng: number;
  radiusM: number;
  startsAt: string; // ISO date
  endsAt: string; // ISO date
}

// GET /events, GET /events/:id, POST /events …
export interface EventView {
  id: string;
  name: string;
  description: string;
  visibility: EventVisibility;
  license: EventLicense;
  geo: EventGeo | null; // only when license = 'geo'
  owner: { id: string; displayName: string };
  myRole: MemberRole | null; // null = not a member (public events only)
  // Only shown to members: it's what lets people into a private event.
  inviteCode: string | null;
  // For license 'geo' this depends on your location: pass ?lat=&lng=.
  participation: Participation;
  createdAt: string;
}

export type QueueTrackStatus = 'queued' | 'playing' | 'played';

// One entry of an event's queue.
export interface QueueTrack extends TrackSummary {
  id: string; // the queue entry's id (not the provider's track id)
  score: number; // number of votes
  status: QueueTrackStatus;
  suggestedBy: { id: string; displayName: string } | null;
  suggestedAt: string; // ISO date — tie-break: earliest first
  votedByMe: boolean;
}

// GET /events/:id/queue
export interface QueueView {
  nowPlaying: QueueTrack | null;
  // Ranked: score DESC, then suggestedAt ASC (ties never reshuffle).
  upcoming: QueueTrack[];
}

// POST / DELETE /events/:id/tracks/:trackId/vote
export interface VoteResult {
  trackId: string;
  score: number;
  votedByMe: boolean;
}

// ---------- Track Vote realtime (Socket.IO, namespace /events) ----------
// Full reference: docs/realtime.md

// Same for every listener, so it has no votedByMe: each app keeps its own
// votes (from GET /queue and its own vote/unvote responses).
export type BroadcastTrack = Omit<QueueTrack, 'votedByMe'>;

export interface QueueBroadcast {
  eventId: string;
  nowPlaying: BroadcastTrack | null;
  upcoming: BroadcastTrack[];
}

// Server -> client
export interface ServerToClientEvents {
  'queue:updated': (payload: QueueBroadcast) => void;
  // Details changed (name, license, …) or memberships changed: refetch GET /events/:id.
  'event:updated': (payload: { eventId: string }) => void;
  'event:deleted': (payload: { eventId: string }) => void;
  // You were removed from the room (e.g. the event became private).
  'event:access-lost': (payload: { eventId: string }) => void;
}

export type JoinAck = { ok: true } | { ok: false; error: string };

// Client -> server (with an acknowledgement callback)
export interface ClientToServerEvents {
  'event:join': (payload: { eventId: string }, ack: (res: JoinAck) => void) => void;
  'event:leave': (payload: { eventId: string }, ack: (res: { ok: true }) => void) => void;
}

// ---------- Playlist Editor ----------

export type PlaylistVisibility = 'public' | 'private';
// Who may edit (add / remove / reorder): open = anyone who can see it ·
// invited = owner + invited accounts only. Everyone who can see it can listen.
export type PlaylistLicense = 'open' | 'invited';

// Why you can't edit (or see) a playlist.
export type EditDenyReason = 'not_member' | 'not_invited';
export type EditPermission = { allowed: true } | { allowed: false; reason: EditDenyReason };

// GET /playlists, GET /playlists/:id, POST /playlists …
export interface PlaylistView {
  id: string;
  name: string;
  description: string;
  visibility: PlaylistVisibility;
  license: PlaylistLicense;
  owner: { id: string; displayName: string };
  myRole: MemberRole | null; // null = not a member (public playlists only)
  inviteCode: string | null; // members only
  canEdit: EditPermission;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

// One track of a playlist. Sort by `position` with plain code-unit
// comparison (a < b), NOT localeCompare: "Zz" must come before "a0".
export interface PlaylistTrackView extends TrackSummary {
  id: string; // the playlist entry's id (use it to move / remove)
  position: string; // fractional key
  addedBy: { id: string; displayName: string } | null;
  addedAt: string; // ISO date
}

// GET /playlists/:id/tracks
export interface PlaylistTracksView {
  playlistId: string;
  tracks: PlaylistTrackView[]; // already in order
}
