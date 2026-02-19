import { generateSeedList, runSimulation } from './runner';
import { createDefaultConfig } from '../config';

describe('generateSeedList', () => {
  it('returns deterministic sequence 0..count-1', () => {
    expect(generateSeedList(0)).toEqual([]);
    expect(generateSeedList(3)).toEqual([0, 1, 2]);
    expect(generateSeedList(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('runSimulation', () => {
  it('same seed produces same score for same strategy', () => {
    const config = createDefaultConfig({
      gameCount: 5,
      seedList: [0, 0, 0],
    });
    const r1 = runSimulation(config);
    const r2 = runSimulation(config);
    expect(r1.results.length).toBeGreaterThan(0);
    for (let i = 0; i < r1.results.length; i++) {
      expect(r1.results[i].scores).toEqual(r2.results[i].scores);
    }
  });

  it('different strategies get same seed list', () => {
    const config = createDefaultConfig({
      gameCount: 3,
      seedList: [7, 42, 100],
    });
    const { results, seeds } = runSimulation(config);
    expect(seeds).toEqual([7, 42, 100]);
    for (const r of results) {
      expect(r.scores.length).toBe(3);
    }
  });

  it('perGameMetrics has correct shape', () => {
    const config = createDefaultConfig({ gameCount: 2 });
    const { results } = runSimulation(config);
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r.perGameMetrics.length).toBe(2);
    for (const m of r.perGameMetrics) {
      expect(m).toMatchObject({
        score: expect.any(Number),
        isPerfect: expect.any(Boolean),
        livesRemaining: expect.any(Number),
        hintsRemaining: expect.any(Number),
        misplayCount: expect.any(Number),
        endReason: expect.stringMatching(/^(lives_zero|max_score|deck_empty)$/),
      });
      expect(m.isPerfect).toBe(m.score === 25);
    }
  });

  it('timing has correct shape', () => {
    const config = createDefaultConfig({ gameCount: 2 });
    const { results } = runSimulation(config);
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r.timing).toMatchObject({
      totalMs: expect.any(Number),
      avgPerGameMs: expect.any(Number),
      avgDecisionMs: expect.any(Number),
      maxDecisionMs: expect.any(Number),
    });
  });

  it('debug mode captures traces', () => {
    const config = createDefaultConfig({
      gameCount: 2,
      loggingMode: 'debug',
    });
    const { results } = runSimulation(config);
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r.traces).toBeDefined();
    expect(r.traces!.length).toBe(2);
    for (const t of r.traces!) {
      expect(t).toMatchObject({
        seed: expect.any(Number),
        initialDeckOrder: expect.any(Array),
        events: expect.any(Array),
        finalState: expect.objectContaining({
          score: expect.any(Number),
          livesRemaining: expect.any(Number),
          hintsRemaining: expect.any(Number),
          endReason: expect.any(String),
        }),
      });
      expect(t.initialDeckOrder.length).toBe(50);
    }
  });
});
