# Realtime API — Track Vote and Playlist Editor

Live updates for Track Vote events, over **Socket.IO 4** (namespace **`/events`**). The socket only **receives**: every change (suggest, vote, un-vote, edit an event) goes through the REST API, and the server pushes the result to everyone watching.

Types for all payloads: `packages/shared/src/index.ts` (`ServerToClientEvents`, `ClientToServerEvents`, `QueueBroadcast`).

## Connecting

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/events', {
  auth: { token: accessToken }, // the same JWT as `Authorization: Bearer …`
  transports: ['websocket'],
});

socket.on('connect_error', (err) => {
  // err.message === 'unauthorized' -> missing / invalid / expired token:
  // refresh it (POST /auth/refresh), set socket.auth.token, then socket.connect()
});
```

- The token is checked **once, when connecting**. An open socket keeps working after the 15-minute token expires; a *re*connection needs a fresh token.
- After any reconnect, re-join your rooms and reload the queue with `GET /events/:id/queue` (messages sent while you were offline are not replayed).

## Client → server

Both use an acknowledgement callback (`emitWithAck`).

| Message | Payload | Ack | Who may |
|---|---|---|---|
| `event:join` | `{ eventId }` | `{ ok: true }` or `{ ok: false, error: 'Event not found' }` | Anyone who can see the event — **same rule as `GET /events/:id`**: public events for any logged-in user, private events for members only. A private event you can't see answers exactly like one that doesn't exist. |
| `event:leave` | `{ eventId }` | `{ ok: true }` | Anyone |

```js
const res = await socket.emitWithAck('event:join', { eventId });
if (!res.ok) showError(res.error);
```

## Server → client

Sent to everyone in the event's room, **after** the change is committed to the database.

| Message | Payload | When | What the app should do |
|---|---|---|---|
| `queue:updated` | `QueueBroadcast` | A track was suggested, voted on, or un-voted | Replace the queue on screen with `payload.upcoming` / `payload.nowPlaying` |
| `event:updated` | `{ eventId }` | Name, description, visibility, license or geo area changed, or someone was invited | Refetch `GET /events/:id` (your own role / right to vote may have changed) |
| `event:access-lost` | `{ eventId }` | You can no longer see the event (e.g. it became private and you're not a member). You've been removed from the room. | Leave the event screen |
| `event:deleted` | `{ eventId }` | The owner deleted the event. Everyone is removed from the room. | Leave the event screen |

### `QueueBroadcast`

```ts
{
  eventId: string;
  nowPlaying: BroadcastTrack | null;
  upcoming: BroadcastTrack[]; // ranked: score DESC, then suggestedAt ASC (earliest first)
}

// BroadcastTrack
{
  id: string;              // queue entry id (use it to vote)
  provider: 'deezer';
  providerTrackId: string;
  title: string; artist: string; album: string;
  coverUrl: string | null;
  durationSec: number;
  isrc: string | null;
  score: number;           // number of votes
  status: 'queued' | 'playing' | 'played';
  suggestedBy: { id: string; displayName: string } | null;
  suggestedAt: string;     // ISO date
}
```

The broadcast is identical for every listener, so it has **no `votedByMe`**. Each app keeps its own set of "tracks I voted for": from `GET /events/:id/queue` (which does include `votedByMe`) and from its own `POST`/`DELETE …/vote` responses.

## Batching

Queue changes for the same event within **100 ms** are sent as **one** `queue:updated` carrying the latest state. A burst such as ten phones voting in the same second therefore produces one or two messages instead of ten, and always ends on the correct final scores. (Measured: 10 simultaneous votes → 1 message with score 10.)

## Scaling note

Rooms live in the memory of the API process: fine for a single server. Running several API instances behind a load balancer would need the Socket.IO **Redis adapter** so a vote handled by one instance reaches sockets connected to another.

## Tests

```bash
npm run test:realtime --workspace=apps/api   # needs the API running
```

Covers: refused without/with a bad token; join rules; one vote reaching every listener; burst batching; a socket removed when the event becomes private (and unable to re-join); deletion.

---

# Playlist Editor — namespace `/playlists`

Same connection rules as `/events`: a valid access token in `auth.token`, otherwise `connect_error: unauthorized`. The server only **sends**. Every change goes through REST (`POST`/`PATCH`/`DELETE /playlists/:id/tracks…`).

```ts
import { io, Socket } from 'socket.io-client';
import type { PlaylistClientToServerEvents, PlaylistServerToClientEvents } from '@music-room/shared';

const socket: Socket<PlaylistServerToClientEvents, PlaylistClientToServerEvents> =
  io(`${API_URL}/playlists`, { auth: { token: accessToken }, transports: ['websocket'] });
```

## Client → server

| Event | Payload | Ack |
|---|---|---|
| `playlist:join` | `{ playlistId }` | `{ ok: true }` or `{ ok: false, error: 'Playlist not found' }`. This is the same rule as `GET /playlists/:id`: a private playlist's room is for members only |
| `playlist:leave` | `{ playlistId }` | `{ ok: true }` |

**Join first, then load.** Call `playlist:join`, wait for the ack, then call `GET /playlists/:id/tracks`. A change that happens in between is then both in the list and in a message, which is harmless (see "Applying the messages"). The other order could miss a change entirely. After a reconnect, do the same again: join, then refetch.

## Server → client: small change messages

Unlike Track Vote, which resends the whole ranked queue, the Playlist Editor sends **only what changed**. This works because a position is a fractional key, and the key is *absolute*: "track X is now at `a0V`" is correct on its own, whatever else changed meanwhile. No other track's position changes when one moves.

| Event | Payload | Apply it as |
|---|---|---|
| `track:added` | `{ playlistId, track: PlaylistTrackView }` | upsert by `track.id` |
| `track:moved` | `{ playlistId, trackId, position }` | set that track's `position` (ignore an unknown id) |
| `track:removed` | `{ playlistId, trackId }` | drop it (ignore an unknown id) |
| `playlist:updated` | `{ playlistId }` | refetch `GET /playlists/:id`: the name, license or `canEdit` may have changed |
| `playlist:deleted` | `{ playlistId }` | close the screen |
| `playlist:access-lost` | `{ playlistId }` | you were removed from the room (for example, the playlist became private) |

Then **sort by `position` with plain comparison** (`a < b`), never `localeCompare`. `"Zz"` must come before `"a0"`, which is the byte order the database uses (`COLLATE "C"`).

```ts
const byPosition = (a: PlaylistTrackView, b: PlaylistTrackView) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
```

Your own changes come back to you too. Upserting by id makes that harmless, and an optimistic update in the app is confirmed rather than duplicated.

**Rules followed for every message:**
- A message is sent only **after** its change has committed.
- Two people deleting the same track at the same moment produce **one** `track:removed`, sent by whichever request actually deleted it.
- There is no batching. Each message is a few hundred bytes, and every one is meaningful (unlike votes, where only the final score matters).

## Tests

```bash
npm run test:playlist-race --workspace=apps/api       # concurrency of the REST routes
npm run test:playlist-realtime --workspace=apps/api   # this namespace
```

`test:playlist-realtime` covers:
- refused tokens;
- the join rules;
- the shape of each message;
- 2 simultaneous deletes producing 1 message;
- **30 concurrent adds, moves and removes from 2 people, after which 3 listeners' lists, each built only from the messages, are identical to `GET /tracks`**;
- an invite sending `playlist:updated`;
- going private removing a non-member (who then receives nothing more);
- deletion.
