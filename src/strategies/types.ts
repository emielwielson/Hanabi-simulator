import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { FinalState, GameEvent } from '../engine/events';
import type { Observation } from '../engine/observation';

export type { Observation };
export type { VisibleCard } from '../engine/observation';

/**
 * Strategy interface. One implementation is cloned per seat (FR-12).
 */
export interface HanabiStrategy {
  initialize(config: GameConfig, seatIndex: number): void;
  onGameStart(observation: Observation): void;
  getAction(observation: Observation): Action;
  onActionResolved(event: GameEvent): void;
  onGameEnd(result: FinalState): void;
  clone(): HanabiStrategy;
}

// Re-export for convenience
export type { Action, GameConfig, GameEvent, FinalState };
