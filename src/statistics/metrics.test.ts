import {
  computeAggregateMetrics,
  tTest,
  scoreHistogram,
  formatComparison,
} from './metrics';
import type { StrategyResult } from '../simulator/runner';

function makeResult(
  name: string,
  scores: number[],
  perGameMetrics?: Array<{
    score: number;
    isPerfect: boolean;
    livesRemaining: number;
    hintsRemaining: number;
    misplayCount: number;
    endReason: 'lives_zero' | 'max_score' | 'deck_empty';
  }>
): StrategyResult {
  const metrics =
    perGameMetrics ??
    scores.map((score) => ({
      score,
      isPerfect: score === 25,
      livesRemaining: 3,
      hintsRemaining: 8,
      misplayCount: 0,
      endReason: 'deck_empty' as const,
    }));
  return {
    name,
    scores,
    perGameMetrics: metrics,
    timing: { totalMs: 0, avgPerGameMs: 0, avgDecisionMs: 0, maxDecisionMs: 0 },
  };
}

describe('scoreHistogram', () => {
  it('returns 26 bins (0-25)', () => {
    expect(scoreHistogram([])).toHaveLength(26);
  });

  it('counts scores into correct bins', () => {
    const hist = scoreHistogram([0, 0, 25, 25, 12]);
    expect(hist[0]).toBe(2);
    expect(hist[12]).toBe(1);
    expect(hist[25]).toBe(2);
  });
});

describe('computeAggregateMetrics', () => {
  it('computes avgScore and stdDev', () => {
    const result = makeResult('A', [10, 20, 30]);
    const m = computeAggregateMetrics(result);
    expect(m.avgScore).toBe(20);
    expect(m.stdDev).toBeGreaterThan(0);
  });

  it('computes perfectRate', () => {
    const result = makeResult('A', [25, 25, 10]);
    const m = computeAggregateMetrics(result);
    expect(m.perfectRate).toBeCloseTo(2 / 3);
  });

  it('returns zero stats for empty scores', () => {
    const result = makeResult('A', []);
    const m = computeAggregateMetrics(result);
    expect(m.avgScore).toBe(0);
    expect(m.stdDev).toBe(0);
    expect(m.perfectRate).toBe(0);
    expect(m.scoreHistogram).toHaveLength(26);
  });

  it('includes scoreHistogram in output', () => {
    const result = makeResult('A', [5, 10, 15]);
    const m = computeAggregateMetrics(result);
    expect(m.scoreHistogram).toHaveLength(26);
    expect(m.scoreHistogram[5] + m.scoreHistogram[10] + m.scoreHistogram[15]).toBe(3);
  });
});

describe('tTest', () => {
  it('identical arrays yield p-value near 1', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const tt = tTest(arr, [...arr]);
    expect(tt.pValue).toBeGreaterThan(0.99);
    expect(tt.meanDiff).toBe(0);
  });

  it('very different arrays yield low p-value', () => {
    const a = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const b = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    const tt = tTest(a, b);
    expect(tt.pValue).toBeLessThan(0.001);
  });

  it('small samples return pValue 1', () => {
    const tt = tTest([1], [2]);
    expect(tt.pValue).toBe(1);
  });
});

describe('formatComparison', () => {
  it('produces formatted output with all lines', () => {
    const a = makeResult('StrategyA', [20, 21, 22, 23, 24]);
    const b = makeResult('StrategyB', [23, 24, 24, 24, 25]);
    const out = formatComparison('A', 'B', a, b);
    expect(out).toContain('A avg:');
    expect(out).toContain('B avg:');
    expect(out).toContain('p-value:');
    expect(out).toContain('Conclusion:');
  });
});
