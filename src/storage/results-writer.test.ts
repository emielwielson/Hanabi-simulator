import * as fs from 'fs';
import * as path from 'path';
import { writeResults } from './results-writer';
import type { SimulationResult } from '../simulator/runner';
import { createDefaultConfig } from '../config';
import { Color } from '../engine/types';

describe('writeResults', () => {
  const mockResult: SimulationResult = {
    results: [
      {
        name: 'TestStrategy',
        scores: [10, 20, 30],
        perGameMetrics: [
          { score: 10, isPerfect: false, livesRemaining: 2, hintsRemaining: 5, misplayCount: 1, endReason: 'lives_zero' },
          { score: 20, isPerfect: false, livesRemaining: 3, hintsRemaining: 6, misplayCount: 0, endReason: 'deck_empty' },
          { score: 30, isPerfect: false, livesRemaining: 1, hintsRemaining: 4, misplayCount: 2, endReason: 'lives_zero' },
        ],
        timing: { totalMs: 10, avgPerGameMs: 3.33, avgDecisionMs: 0.1, maxDecisionMs: 0.5 },
      },
    ],
    seeds: [0, 1, 2],
  };

  it('creates results directory with summary, raw_scores, stats', () => {
    const config = createDefaultConfig();
    const outputDir = writeResults(mockResult, config);

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'summary.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'raw_scores.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'stats.json'))).toBe(true);

    const summary = JSON.parse(fs.readFileSync(path.join(outputDir, 'summary.json'), 'utf-8'));
    expect(summary.strategyNames).toContain('TestStrategy');
    expect(summary.gameCount).toBe(3);

    const rawScores = JSON.parse(fs.readFileSync(path.join(outputDir, 'raw_scores.json'), 'utf-8'));
    expect(rawScores.TestStrategy).toEqual([10, 20, 30]);

    const stats = JSON.parse(fs.readFileSync(path.join(outputDir, 'stats.json'), 'utf-8'));
    expect(stats.TestStrategy.avgScore).toBe(20);
    expect(stats.TestStrategy.scoreHistogram).toHaveLength(26);
  });

  it('writes traces/ in debug mode', () => {
    const resultWithTraces: SimulationResult = {
      results: [
        {
          ...mockResult.results[0],
          traces: [
            {
              seed: 42,
              initialDeckOrder: [{ id: 0, color: Color.Red, value: 1 }],
              events: [],
              finalState: {
                score: 15,
                livesRemaining: 2,
                hintsRemaining: 4,
                endReason: 'deck_empty',
                playedStacks: { [Color.Red]: 1, [Color.Yellow]: 0, [Color.Green]: 0, [Color.Blue]: 0, [Color.White]: 0 },
                discardPile: [],
              },
            },
          ],
        },
      ],
      seeds: [42],
    };
    const config = createDefaultConfig({ loggingMode: 'debug' });
    const outputDir = writeResults(resultWithTraces, config);

    const tracesDir = path.join(outputDir, 'traces');
    expect(fs.existsSync(tracesDir)).toBe(true);
    const files = fs.readdirSync(tracesDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('.json'))).toBe(true);
  });
});
