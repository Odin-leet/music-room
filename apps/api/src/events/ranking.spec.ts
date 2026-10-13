import { compareQueueTracks } from '@music-room/shared';

// The queue's ranking rule (brief: score, ties broken by the earliest
// suggestion). The API orders the same way in SQL (queue.service.ts:
// score DESC, suggestedAt ASC, id ASC); test:race checks the real queue.
const track = (id: string, score: number, suggestedAt: string) => ({ id, score, suggestedAt });
const rank = (...tracks: ReturnType<typeof track>[]) => [...tracks].sort(compareQueueTracks).map((t) => t.id);

describe('queue ranking', () => {
  it('puts the most voted track first', () => {
    expect(rank(track('a', 1, '2026-10-13T10:00:00.000Z'), track('b', 5, '2026-10-13T10:05:00.000Z'))).toEqual(['b', 'a']);
  });

  it('breaks a tie with the earliest suggestion', () => {
    expect(rank(track('late', 3, '2026-10-13T10:05:00.000Z'), track('early', 3, '2026-10-13T10:00:00.000Z'))).toEqual([
      'early',
      'late',
    ]);
  });

  it('a later vote never lets a newer track jump an older one at the same score', () => {
    // Same score: suggestion time decides, whatever the order they arrive in.
    const tracks = [
      track('t3', 1, '2026-10-13T10:03:00.000Z'),
      track('t1', 1, '2026-10-13T10:01:00.000Z'),
      track('t2', 1, '2026-10-13T10:02:00.000Z'),
    ];
    expect(rank(...tracks)).toEqual(['t1', 't2', 't3']);
    expect(rank(...[...tracks].reverse())).toEqual(['t1', 't2', 't3']);
  });

  it('is fully deterministic: same score and same time -> by id', () => {
    const at = '2026-10-13T10:00:00.000Z';
    expect(rank(track('b', 2, at), track('a', 2, at))).toEqual(['a', 'b']);
  });

  it('ranks a whole queue: score, then time', () => {
    expect(
      rank(
        track('new-popular', 4, '2026-10-13T10:09:00.000Z'),
        track('old-unpopular', 0, '2026-10-13T10:00:00.000Z'),
        track('old-tied', 2, '2026-10-13T10:01:00.000Z'),
        track('new-tied', 2, '2026-10-13T10:08:00.000Z'),
      ),
    ).toEqual(['new-popular', 'old-tied', 'new-tied', 'old-unpopular']);
  });
});
