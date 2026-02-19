import { createSeededRNG } from './seeded-rng';

describe('createSeededRNG', () => {
  it('produces identical sequence for same seed', () => {
    const rng1 = createSeededRNG(12345);
    const rng2 = createSeededRNG(12345);

    const seq1 = [rng1(), rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences for different seeds', () => {
    const rng1 = createSeededRNG(111);
    const rng2 = createSeededRNG(222);

    const seq1 = [rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2()];

    expect(seq1).not.toEqual(seq2);
  });

  it('yields values in [0, 1) range', () => {
    const rng = createSeededRNG(42);
    for (let i = 0; i < 100; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
