import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

// Playlist order without locks ("fractional indexing").
//
// Each track's position is a string key; the playlist is sorted by these
// keys compared byte by byte (the DB column uses COLLATE "C" for exactly
// that). Putting a track somewhere = giving it a key strictly between its
// new neighbours' keys. No other row changes, so concurrent moves of
// different tracks never touch the same row and need no lock.
//
//   a0 < a0V < a1 < a2      ("a0V" was created between "a0" and "a1")
//
// `null` means "no neighbour": keyBetween(null, 'a0') = before the first
// track, keyBetween('a3', null) = after the last one.

// Keys stay short in practice, but each insert into the *same* gap can add a
// character (≈ 1 per 4–5 inserts in the worst case). The column holds
// MAX_POSITION_LENGTH; past REBALANCE_AT the playlist's keys get respread.
export const MAX_POSITION_LENGTH = 255;
export const REBALANCE_AT = 128;

export function keyBetween(before: string | null, after: string | null): string {
  // The library doesn't check this itself; wrong-order neighbours would
  // silently corrupt the order, so refuse them.
  if (before !== null && after !== null && byPosition(before, after) >= 0) {
    throw new Error(`keyBetween: "${before}" must sort before "${after}"`);
  }
  return generateKeyBetween(before, after);
}

// A key strictly between the neighbours, but at a random spot in the gap
// rather than the middle. Used when retrying after a collision: N people
// who read the same neighbours at the same instant all compute the same
// middle key, so on retry each picks a different random spot instead.
// (Random walk: up to `depth` times, keep the left or right half at random.)
export function randomKeyBetween(before: string | null, after: string | null, depth = 4): string {
  let lo = before;
  let hi = after;
  let key = keyBetween(lo, hi);
  for (let i = 0; i < depth; i++) {
    if (Math.random() < 0.5) hi = key;
    else lo = key;
    key = keyBetween(lo, hi);
  }
  return key;
}

// n evenly spread keys (used if a playlist ever needs rebalancing).
export function keysBetween(before: string | null, after: string | null, n: number): string[] {
  return generateNKeysBetween(before, after, n);
}

// The sort the database does with COLLATE "C": plain code-unit order, not a
// language-aware comparison ('Z' < 'a', which localeCompare may not respect).
export function byPosition(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
