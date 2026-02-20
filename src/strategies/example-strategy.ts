import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';
import { getDeterministicRandom } from './observation-rng';

/**
 * Example baseline strategy: picks a random legal action using seeded RNG (FR-17).
 * Requires observation.legalActions to be populated by the engine.
 */
export class ExampleStrategy implements HanabiStrategy {
  private readonly rngSeed: number;

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  getAction(observation: Observation): Action {
    const legalActions = observation.legalActions;
    if (!legalActions || legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      return { type: 'play', cardIndex: 0 };
    }
    const rng = getDeterministicRandom(observation, this.rngSeed);
    const idx = Math.floor(rng * legalActions.length);
    return { ...legalActions[idx] };
  }
}
