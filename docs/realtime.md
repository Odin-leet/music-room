# Realtime API — Track Vote

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
