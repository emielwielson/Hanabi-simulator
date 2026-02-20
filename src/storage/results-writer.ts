import * as fs from 'fs';
import * as path from 'path';
import type { SimulationResult } from '../simulator/runner';
import type { GameConfig } from '../config';
import { computeAggregateMetrics } from '../statistics/metrics';
import type { AggregateMetrics } from '../statistics/metrics';

/**
 * Writes simulation results to results/{timestamp}/. Returns the output directory path.
 */
export function writeResults(
  simulationResult: SimulationResult,
  config: GameConfig
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resultsDir = path.join(process.cwd(), 'results', timestamp);
  fs.mkdirSync(resultsDir, { recursive: true });

  const rawScores: Record<string, number[]> = {};
  const stats: Record<string, AggregateMetrics> = {};

  for (const result of simulationResult.results) {
    rawScores[result.name] = result.scores;
    stats[result.name] = computeAggregateMetrics(result);
  }

  const strategyTiming: Record<string, { totalMs: number; avgPerGameMs: number }> = {};
  for (const r of simulationResult.results) {
    strategyTiming[r.name] = { totalMs: r.timing.totalMs, avgPerGameMs: r.timing.avgPerGameMs };
  }

  const summaryPayload: Record<string, unknown> = {
    timestamp,
    strategyNames: simulationResult.results.map((r) => r.name),
    gameCount: simulationResult.seeds.length,
    strategyTiming,
    config: {
      playerCount: 2,
      hintTokens: config.hintTokens,
      lifeTokens: config.lifeTokens,
      loggingMode: config.loggingMode,
    },
  };

  if (config.loggingMode === 'debug') {
    const traceIndex: Record<string, { seed: number; score: number; endReason: string; livesRemaining: number; hintsRemaining: number; misplayCount: number; filename: string }[]> = {};
    for (const result of simulationResult.results) {
      if (!result.traces) continue;
      traceIndex[result.name] = result.traces.map((trace, i) => {
        const misplayCount = trace.events.filter((e) => e.type === 'play' && !e.success).length;
        return {
          seed: trace.seed,
          score: trace.finalState.score,
          endReason: trace.finalState.endReason,
          livesRemaining: trace.finalState.livesRemaining,
          hintsRemaining: trace.finalState.hintsRemaining,
          misplayCount,
          filename: `${sanitizeFilename(result.name)}_${trace.seed}_${i}.json`,
        };
      });
    }
    summaryPayload.traceIndex = traceIndex;
  }

  fs.writeFileSync(
    path.join(resultsDir, 'summary.json'),
    JSON.stringify(summaryPayload, null, 2)
  );

  fs.writeFileSync(
    path.join(resultsDir, 'raw_scores.json'),
    JSON.stringify(rawScores, null, 2)
  );

  fs.writeFileSync(
    path.join(resultsDir, 'stats.json'),
    JSON.stringify(stats, null, 2)
  );

  if (config.loggingMode === 'debug') {
    const tracesDir = path.join(resultsDir, 'traces');
    fs.mkdirSync(tracesDir, { recursive: true });

    for (const result of simulationResult.results) {
      if (!result.traces) continue;
      for (let i = 0; i < result.traces.length; i++) {
        const trace = result.traces[i];
        const filename = `${sanitizeFilename(result.name)}_${trace.seed}_${i}.json`;
        fs.writeFileSync(
          path.join(tracesDir, filename),
          JSON.stringify(trace, null, 2)
        );
      }
    }
  }

  return resultsDir;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
