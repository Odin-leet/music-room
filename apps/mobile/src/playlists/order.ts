import type { PlaylistTrackView } from '@music-room/shared';
import { generateKeyBetween } from 'fractional-indexing';

// The playlist's order is its tracks sorted by `position`, compared as plain
// strings, exactly like the database (COLLATE "C"). Never localeCompare:
// "Zz" must sort before "a0".
export const byPosition = (a: PlaylistTrackView, b: PlaylistTrackView) =>
  a.position < b.position ? -1 : a.position > b.position ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export const sorted = (tracks: PlaylistTrackView[]) => [...tracks].sort(byPosition);

// The key the server will most likely give a track moved between these two
// neighbours (same library, same algorithm). Used to show a move instantly;
// the server's answer then confirms or corrects it.
export function guessPosition(before: PlaylistTrackView | undefined, after: PlaylistTrackView | undefined) {
  try {
    return generateKeyBetween(before?.position ?? null, after?.position ?? null);
  } catch {
    return null; // neighbours out of order locally: wait for the server
  }
}

// What to send as `afterId` to put `list[index]` where it now is: the track
// right above it, or null for the top.
export const afterIdAt = (list: PlaylistTrackView[], index: number) => (index > 0 ? list[index - 1].id : null);
