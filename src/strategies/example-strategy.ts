import { createSeededRNG } from '../engine/seeded-rng';
import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';

/**
 * Example baseline strategy: picks a random legal action using seeded RNG (FR-17).
 * Requires observation.legalActions to be populated by the engine.
 */
export class ExampleStrategy implements HanabiStrategy {
  private config: GameConfig | null = null;
  private seatIndex = 0;
  private rng: (() => number) | null = null;
  private rngSeed: number;

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  initialize(config: GameConfig, seatIndex: number): void {
    this.config = config;
    this.seatIndex = seatIndex;
    this.rng = createSeededRNG(this.rngSeed + seatIndex);
  }

  onGameStart(_observation: Observation): void {
    // No-op
  }

  getAction(observation: Observation): Action {
    if (!this.rng) {
      throw new Error('Strategy not initialized');
    }
    const legalActions = observation.legalActions;
    if (!legalActions || legalActions.length === 0) {
      // Fallback: discard first card if we have one
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      // Last resort: play first card (may be invalid, engine will reject)
      return { type: 'play', cardIndex: 0 };
    }
    const idx = Math.floor(this.rng() * legalActions.length);
    return { ...legalActions[idx] };
  }

  onActionResolved(_event: import('../engine/events').GameEvent): void {
    // No-op
  }

  onGameEnd(_result: import('../engine/events').FinalState): void {
    // No-op
  }

  clone(): HanabiStrategy {
    return new ExampleStrategy(this.rngSeed);
  }
}
