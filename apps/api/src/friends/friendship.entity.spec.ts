import { pairOf } from './friendship.entity';

describe('pairOf', () => {
  const x = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
  const y = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  it('stores a pair the same way whoever asks', () => {
    expect(pairOf(x, y)).toEqual(pairOf(y, x));
    expect(pairOf(x, y)).toEqual({ userAId: x, userBId: y });
  });

  it('ignores letter case, like Postgres uuids', () => {
    expect(pairOf(y.toUpperCase(), x)).toEqual({ userAId: x, userBId: y });
  });
});
