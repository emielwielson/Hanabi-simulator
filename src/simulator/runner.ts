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
  strategyClones: HanabiStrategy[],
  options: { collectTrace: boolean; decisionTimes: number[] }
): { finalState: FinalState; events: GameEvent[]; metrics: PerGameMetrics; trace?: GameTrace } {
  const state = createInitialState(
    seed,
    config.playerCount,
    config.hintTokens,
    config.lifeTokens
  );

  for (let seat = 0; seat < config.playerCount; seat++) {
    const obs = buildObservation(state, seat);
    strategyClones[seat].onGameStart(obs);
  }

  while (!state.gameOver) {
    const obs = buildObservation(state, state.currentPlayer);
    const t0 = performance.now();
    const action = strategyClones[state.currentPlayer].getAction(obs);
    const t1 = performance.now();
    options.decisionTimes.push(t1 - t0);
    const event = executeAction(state, action);
    for (const s of strategyClones) {
      s.onActionResolved(event);
    }
  }

  const finalState: FinalState = {
    score: calculateScore(state.playedStacks),
    livesRemaining: state.lifeTokens,
    hintsRemaining: state.hintTokens,
    endReason: state.endReason!,
    playedStacks: { ...state.playedStacks },
    discardPile: [...state.discardPile],
  };

  for (const s of strategyClones) {
    s.onGameEnd(finalState);
  }

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
      const clones: HanabiStrategy[] = Array.from(
        { length: config.playerCount },
        () => base.clone()
      );
      for (let i = 0; i < clones.length; i++) {
        clones[i].initialize(config, i);
      }

      const { metrics, trace } = runSingleGame(seed, config, clones, {
        collectTrace,
        decisionTimes,
      });
      scores.push(metrics.score);
      perGameMetrics.push(metrics);
      if (trace) traces.push(trace);
    }

    const t1 = performance.now();
    const totalMs = t1 - t0;
    const avgDecisionMs =
      decisionTimes.length > 0
        ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
        : 0;
    const maxDecisionMs =
      decisionTimes.length > 0 ? Math.max(...decisionTimes) : 0;

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
