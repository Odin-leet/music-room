# V.2.2 Music Control Delegation: design (not built)

The brief asks for three services and accepts two. Track Vote and Playlist
Editor are built. This page is the design for the third, so the decision to
cut it is a scoped one and not a gap nobody looked at. Nothing below exists in
the code.

## What it is

You play music on one of your devices (say, the speaker phone at a party).
You hand **control** of that device's player (play / pause / skip / volume) to
friends. They control it from their own phones. You can take control back at
any time.

## The model

The **licence is per device**: control of the living-room phone isn't control
of your own phone.

```
devices            id, owner_id, name, last_seen_at
control_grants     id, device_id, owner_id, delegate_id,
                   granted_at, revoked_at NULL
```

- **Active grant** = the newest row for `(device_id, delegate_id)` with
  `revoked_at IS NULL`. Revoking sets `revoked_at` and never deletes the row,
  so the history ("who could control the speaker on Saturday") is kept.
- A partial unique index `(device_id, delegate_id) WHERE revoked_at IS NULL`
  allows only one active grant per person. Granting twice is a no-op, done
  with `INSERT … ON CONFLICT DO NOTHING`, the same pattern as friendships.
- **Who can be granted**: friends only. This reuses the `friends` table, the
  same check as the profile's "friends" tier. Unfriending someone revokes
  their grants in the same transaction.
- **The owner always has control**, so no grant row is needed for them.

## Routes

| Route | Who | |
|---|---|---|
| `POST /devices` | owner | register this phone as a device (name) |
| `GET /devices` | anyone logged in | your devices and the ones you were given control of |
| `POST /devices/:id/grants` `{ userId }` | owner | give control to a friend |
| `DELETE /devices/:id/grants/:userId` | owner | take it back |
| `POST /devices/:id/commands` `{ type: play \| pause \| next \| seek \| volume, … }` | owner or active delegate | 403 `not_delegated` otherwise |

The check is a policy function like `event-policy.ts`: pure and unit-tested,
`canControl(device, userId, activeGrants)`.

## Realtime

A `/devices` namespace with one room per device:

- The **device itself** joins its room and **executes** `player:command`
  (it's the only one actually playing audio). It reports back with
  `player:state` (track, position, paused).
- **Controllers** join the same room (after the same check) to see
  `player:state` live.
- A command goes REST → check → bus → `player:command` to the room, sent
  after commit like the other buses. It doesn't go socket → socket, so the
  permission check, the rate limit and the action log stay in one place.
- Revoking a grant removes the person's sockets from the room
  (`device:access-lost`), the same as `event:access-lost` today.

## Edge cases already thought through

- **Two controllers press "next" at once**: each command carries the
  `trackId` it was meant for, and the device ignores a `next` that doesn't
  match what it's playing, so you never skip two tracks.
- **The device is offline**: commands answer `409 device_offline` when
  `last_seen_at` is older than 30 s (a heartbeat updates it).
- **Owner and delegate disagree**: the last command wins. The owner can
  revoke; there's no locking.

## Why it was cut

- The brief accepts two services out of three. The two built ones
  (vote ranking under concurrency, lock-free reorder) cover the hard
  realtime/consistency problems. Delegation would mostly repeat them:
  membership checks, a room per resource, buses after commit.
- Its real cost is on the **device** side. A phone in Expo Go that obeys
  remote commands reliably in the background needs a background audio
  session and a development build, not Expo Go. That time went into security
  (V.6), load tests (V.7) and CI (V.8) instead.

If it were added, the order would be: the tables + policy + unit tests →
routes → the `/devices` namespace → the "Control" screen in the app.
