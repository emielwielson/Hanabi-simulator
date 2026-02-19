import type { StrategyResult } from '../simulator/runner';
import type { EndReason } from '../engine/events';

export interface AggregateMetrics {
  avgScore: number;
  stdDev: number;
  stdError: number;
  ci95: { lower: number; upper: number };
  perfectRate: number;
  avgLivesRemaining: number;
  avgHintsRemaining: number;
  misplayRate: number;
  endReasonDistribution: Record<EndReason, number>;
  scoreHistogram: number[];
}

export interface TTestResult {
  pValue: number;
  meanDiff: number;
  ci95: { lower: number; upper: number };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sampleStdDev(arr: number[], m?: number): number {
  const n = arr.length;
  if (n < 2) return 0;
  const avg = m ?? mean(arr);
  const sumSq = arr.reduce((s, x) => s + (x - avg) ** 2, 0);
  return Math.sqrt(sumSq / (n - 1));
}

/**
 * Score histogram: bins 0..25, histogram[i] = count of games with score i.
 */
export function scoreHistogram(scores: number[]): number[] {
  const hist = new Array<number>(26).fill(0);
  for (const s of scores) {
    const bin = Math.max(0, Math.min(25, Math.round(s)));
    hist[bin]++;
  }
  return hist;
}

export function computeAggregateMetrics(result: StrategyResult): AggregateMetrics {
  const { scores, perGameMetrics } = result;
  const n = scores.length;

  const avgScore = n > 0 ? mean(scores) : 0;
  const stdDev = sampleStdDev(scores, avgScore);
  const stdError = n > 1 ? stdDev / Math.sqrt(n) : 0;
  const halfWidth = 1.96 * stdError;
  const ci95 = { lower: avgScore - halfWidth, upper: avgScore + halfWidth };

  const perfectCount = perGameMetrics.filter((m) => m.isPerfect).length;
  const perfectRate = n > 0 ? perfectCount / n : 0;

  const avgLivesRemaining =
    n > 0
      ? perGameMetrics.reduce((s, m) => s + m.livesRemaining, 0) / n
      : 0;
  const avgHintsRemaining =
    n > 0
      ? perGameMetrics.reduce((s, m) => s + m.hintsRemaining, 0) / n
      : 0;

  const totalMislays = perGameMetrics.reduce((s, m) => s + m.misplayCount, 0);
  const misplayRate = n > 0 ? totalMislays / n : 0;

  const endReasonDistribution: Record<EndReason, number> = {
    lives_zero: 0,
    max_score: 0,
    deck_empty: 0,
  };
  for (const m of perGameMetrics) {
    endReasonDistribution[m.endReason]++;
  }

  return {
    avgScore,
    stdDev,
    stdError,
    ci95,
    perfectRate,
    avgLivesRemaining,
    avgHintsRemaining,
    misplayRate,
    endReasonDistribution,
    scoreHistogram: scoreHistogram(scores),
  };
}

/**
 * Welch's t-test for comparing two independent samples (unequal variances).
 */
export function tTest(scoresA: number[], scoresB: number[]): TTestResult {
  const nA = scoresA.length;
  const nB = scoresB.length;
  if (nA < 2 || nB < 2) {
    return {
      pValue: 1,
      meanDiff: 0,
      ci95: { lower: 0, upper: 0 },
    };
  }

  const meanA = mean(scoresA);
  const meanB = mean(scoresB);
  const varA = sampleStdDev(scoresA, meanA) ** 2;
  const varB = sampleStdDev(scoresB, meanB) ** 2;
  const seA = varA / nA;
  const seB = varB / nB;
  const seDiff = Math.sqrt(seA + seB);
  if (seDiff === 0) {
    return {
      pValue: meanA === meanB ? 1 : 0,
      meanDiff: meanA - meanB,
      ci95: { lower: meanA - meanB, upper: meanA - meanB },
    };
  }

  const t = (meanA - meanB) / seDiff;
  // Normal approximation (valid for n > 30; typical sim runs 1000+ games)
  const pValue = 2 * (1 - normalCdf(Math.abs(t)));
  const halfWidth = 1.96 * seDiff;
  const meanDiff = meanA - meanB;

  return {
    pValue,
    meanDiff,
    ci95: { lower: meanDiff - halfWidth, upper: meanDiff + halfWidth },
  };
}

function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * Math.abs(x));
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return x >= 0 ? y : 1 - y;
}

export function formatComparison(
  nameA: string,
  nameB: string,
  resultA: StrategyResult,
  resultB: StrategyResult
): string {
  const metricsA = computeAggregateMetrics(resultA);
  const metricsB = computeAggregateMetrics(resultB);
  const tt = tTest(resultA.scores, resultB.scores);

  const lines: string[] = [];
  lines.push(`${nameA} avg: ${metricsA.avgScore.toFixed(2)} ± ${metricsA.stdError.toFixed(2)}`);
  lines.push(`${nameB} avg: ${metricsB.avgScore.toFixed(2)} ± ${metricsB.stdError.toFixed(2)}`);
  lines.push(`p-value: ${tt.pValue.toFixed(3)}`);

  let conclusion: string;
  if (tt.pValue >= 0.05) {
    conclusion = 'No significant difference';
  } else if (metricsA.avgScore > metricsB.avgScore) {
    conclusion = `${nameA} statistically better`;
  } else {
    conclusion = `${nameB} statistically better`;
  }
  lines.push(`Conclusion: ${conclusion}`);

  return lines.join('\n');
}
