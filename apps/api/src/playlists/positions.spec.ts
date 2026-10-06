import {
  byPosition,
  keyBetween,
  keysBetween,
  MAX_POSITION_LENGTH,
  randomKeyBetween,
  REBALANCE_AT,
} from './positions';

describe('fractional positions', () => {
  it('starts an empty playlist', () => {
    expect(keyBetween(null, null)).toBe('a0');
  });

  it('creates a key strictly between two neighbours', () => {
    const k = keyBetween('a0', 'a1');
    expect(byPosition('a0', k)).toBe(-1);
    expect(byPosition(k, 'a1')).toBe(-1);
  });

  it('appends after the last and prepends before the first', () => {
    expect(byPosition('a3', keyBetween('a3', null))).toBe(-1);
    expect(byPosition(keyBetween(null, 'a0'), 'a0')).toBe(-1);
  });

  it('stays ordered and within the column even after 200 inserts into the same gap', () => {
    // Worst case: always squeezing between the first track and the newest key.
    let right = 'a1';
    for (let i = 0; i < 200; i++) {
      const next = keyBetween('a0', right);
      expect(byPosition('a0', next)).toBe(-1);
      expect(byPosition(next, right)).toBe(-1);
      right = next;
    }
    expect(right.length).toBeLessThan(REBALANCE_AT);
    expect(REBALANCE_AT).toBeLessThan(MAX_POSITION_LENGTH);
  });

  it('sorts by plain code units, which is what COLLATE "C" does in Postgres', () => {
    const before = keyBetween(null, 'a0'); // e.g. "Zz": upper-case Z sorts before lower-case a
    expect(['a1', 'a0', before].sort(byPosition)).toEqual([before, 'a0', 'a1']);
  });

  it('randomKeyBetween stays strictly between the neighbours and varies', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const k = randomKeyBetween('a0', 'a1');
      expect(byPosition('a0', k)).toBe(-1);
      expect(byPosition(k, 'a1')).toBe(-1);
      keys.add(k);
    }
    // 2^4 = 16 possible leaves: 100 draws should hit many of them.
    expect(keys.size).toBeGreaterThan(8);
  });

  it('randomKeyBetween works at the ends of the list', () => {
    expect(byPosition(randomKeyBetween(null, 'a0'), 'a0')).toBe(-1);
    expect(byPosition('a5', randomKeyBetween('a5', null))).toBe(-1);
  });

  it('spreads n keys evenly for a rebalance', () => {
    const keys = keysBetween(null, null, 5);
    expect(new Set(keys).size).toBe(5);
    expect([...keys].sort(byPosition)).toEqual(keys);
  });

  it('rejects neighbours given in the wrong order', () => {
    expect(() => keyBetween('a2', 'a1')).toThrow();
  });
});
