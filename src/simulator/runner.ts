import type { GameConfig } from '../config';
import type { HanabiStrategy } from '../strategies/types';
import { getStrategies } from '../strategies/registry';
import { createInitialState } from '../engine/game-state';
import { buildObservation } from '../engine/observation';
import { executeAction, calculateScore } from '../engine/game-engine';
import type { GameEvent, EndReason, FinalState } from '../engine/events';
import type { Card } from '../engine/types';
import { createDeck, shuffleDeck } from '../engine/deck';

/**
 * Generates a deterministic list of seeds. Simple implementation: 0..count-1.
 */
export function generateSeedList(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

export interface PerGameMetrics {
  score: number;
  isPerfect: boolean;
  livesRemaining: number;
  hintsRemaining: number;
  misplayCount: number;
  endReason: EndReason;
}

export interface GameTrace {
  seed: number;
  initialDeckOrder: Card[];
  events: GameEvent[];
  finalState: FinalState;
}

export interface StrategyResult {
  name: string;
  scores: number[];
  perGameMetrics: PerGameMetrics[];
  timing: {
    totalMs: number;
    avgPerGameMs: number;
    avgDecisionMs: number;
    maxDecisionMs: number;
  };
  traces?: GameTrace[];
}

export interface SimulationResult {
  results: StrategyResult[];
  seeds: number[];
}

function countMislays(events: GameEvent[]): number {
  return events.filter((e) => e.type === 'play' && !e.success).length;
}

export function runSingleGame(
  seed: number,
  config: GameConfig,
  strategy: HanabiStrategy,
  options: { collectTrace: boolean; decisionTimes: number[] }
): { finalState: FinalState; events: GameEvent[]; metrics: PerGameMetrics; trace?: GameTrace } {
  const state = createInitialState(seed, config.hintTokens, config.lifeTokens);

  while (!state.gameOver) {
    const obs = buildObservation(state, state.currentPlayer, { gameSeed: seed });
    const t0 = performance.now();
    const action = strategy.getAction(obs);
    const t1 = performance.now();
    options.decisionTimes.push(t1 - t0);
    executeAction(state, action);
  }

  const finalState: FinalState = {
    score: calculateScore(state.playedStacks),
    livesRemaining: state.lifeTokens,
    hintsRemaining: state.hintTokens,
    endReason: state.endReason!,
    playedStacks: { ...state.playedStacks },
    discardPile: [...state.discardPile],
  };

  const metrics: PerGameMetrics = {
    score: finalState.score,
    isPerfect: finalState.score === 25,
    livesRemaining: finalState.livesRemaining,
    hintsRemaining: finalState.hintsRemaining,
    misplayCount: countMislays(state.actionHistory),
    endReason: finalState.endReason,
  };

  let trace: GameTrace | undefined;
  if (options.collectTrace) {
    trace = {
      seed,
      initialDeckOrder: shuffleDeck(createDeck(), seed),
      events: [...state.actionHistory],
      finalState,
    };
  }

  return { finalState, events: state.actionHistory, metrics, trace };
}

export function runSimulation(
  config: GameConfig,
  strategyNames?: string[]
): SimulationResult {
  const seeds =
    config.seedList.length > 0
      ? config.seedList
      : generateSeedList(config.gameCount);

  const strategies = getStrategies().filter(
    (s) => !strategyNames || strategyNames.includes(s.name)
  );

  const results: StrategyResult[] = [];

  for (const strategyEntry of strategies) {
    const base = strategyEntry.factory();
    const scores: number[] = [];
    const perGameMetrics: PerGameMetrics[] = [];
    const decisionTimes: number[] = [];
    const traces: GameTrace[] = [];
    const collectTrace = config.loggingMode === 'debug';

    const t0 = performance.now();

    for (const seed of seeds) {
      const { metrics, trace } = runSingleGame(seed, config, base, {
        collectTrace,
        decisionTimes,
      });
      scores.push(metrics.score);
      perGameMetrics.push(metrics);
      if (trace) traces.push(trace);
    }

    const t1 = performance.now();
    const totalMs = t1 - t0;
    let sumDecisionMs = 0;
    let maxDecisionMs = 0;
    for (let i = 0; i < decisionTimes.length; i++) {
      const t = decisionTimes[i];
      sumDecisionMs += t;
      if (t > maxDecisionMs) maxDecisionMs = t;
    }
    const avgDecisionMs =
      decisionTimes.length > 0 ? sumDecisionMs / decisionTimes.length : 0;

    results.push({
      name: strategyEntry.name,
      scores,
      perGameMetrics,
      timing: {
        totalMs,
        avgPerGameMs: seeds.length > 0 ? totalMs / seeds.length : 0,
        avgDecisionMs,
        maxDecisionMs,
      },
      ...(collectTrace && { traces }),
    });
  }

  return { results, seeds };
}
