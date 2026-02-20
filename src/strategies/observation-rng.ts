import { getSelfSeat } from '../engine/observation';
import { createSeededRNG } from '../engine/seeded-rng';
import type { Observation } from './types';

function seedFromObservation(observation: Observation, baseSeed: number): number {
  const selfSeat = getSelfSeat(observation);
  const turnIndex = observation.actionHistory.filter(
    (e) => e.playerIndex === selfSeat
  ).length;
  return baseSeed + selfSeat * 10000 + turnIndex;
}

/**
 * Returns a deterministic RNG for this observation (for strategies that need multiple random numbers per turn).
 */
export function getDeterministicRNG(
  observation: Observation,
  baseSeed = 0
): () => number {
  return createSeededRNG(seedFromObservation(observation, baseSeed));
}

/**
 * Returns one deterministic random number in [0, 1) from observation context.
 */
export function getDeterministicRandom(
  observation: Observation,
  baseSeed = 0
): number {
  return getDeterministicRNG(observation, baseSeed)();
}
