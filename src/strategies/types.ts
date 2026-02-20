import type { Action } from '../engine/actions';
import type { Observation } from '../engine/observation';

export type { Observation };
export type { VisibleCard } from '../engine/observation';

/**
 * Strategy interface: state in, action out. Stateless; all context is in the observation; use getSelfSeat(observation) for own seat.
 */
export interface HanabiStrategy {
  getAction(observation: Observation): Action;
}

export type { Action };
