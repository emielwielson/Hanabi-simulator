import type { Card, Color } from './types';
import type { GameEvent } from './events';
import type { GameState } from './game-state';
import { PLAYER_COUNT } from './game-state';

/**
 * Card in another player's hand. In standard Hanabi, you see all other players' cards.
 * Use getKnownToHolder(observation, cardId) to derive what that player has been told about this card.
 */
export interface VisibleCard {
  cardId: number;
  color?: Color;
  value?: number;
}

/**
 * Observation passed to strategies. Engine must deep-copy before passing (FR-14).
 * Use getOwnHintKnowledge(observation, slotIndex) and getKnownToHolder(observation, cardId) for hint knowledge.
 */
export interface Observation {
  visibleHands: Record<number, VisibleCard[]>;
  ownHandSize: number;
  /** Card IDs in the observer's hand by slot index; use with actionHistory to derive per-slot hint knowledge. */
  ownCardIds: number[];
  hintsRemaining: number;
  livesRemaining: number;
  discardPile: Card[];
  playedStacks: Record<Color, number>;
  deckCount: number;
  actionHistory: GameEvent[];
}

/**
 * Deep-copies an Observation so strategies cannot mutate the engine's state (FR-14).
 * The engine's buildObservation (Task 2.12) must use this or equivalent when passing to strategy.getAction.
 */
export function deepCopyObservation(obs: Observation): Observation {
  const visibleHands: Record<number, VisibleCard[]> = {};
  for (const [seat, cards] of Object.entries(obs.visibleHands)) {
    visibleHands[Number(seat)] = cards.map((c) => ({ ...c }));
  }
  const playedStacks: Record<number, number> = { ...obs.playedStacks };
  return {
    visibleHands,
    ownHandSize: obs.ownHandSize,
    ownCardIds: [...obs.ownCardIds],
    hintsRemaining: obs.hintsRemaining,
    livesRemaining: obs.livesRemaining,
    discardPile: obs.discardPile.map((c) => ({ ...c })),
    playedStacks,
    deckCount: obs.deckCount,
    actionHistory: [...obs.actionHistory],
  };
}

/**
 * Returns the seat index of the observer (the player this observation is for).
 * The observer's hand is omitted from visibleHands, so the missing seat is self.
 */
export function getSelfSeat(observation: Observation): number {
  const keys = new Set(Object.keys(observation.visibleHands).map(Number));
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (!keys.has(i)) return i;
  }
  throw new Error('getSelfSeat: no missing seat in visibleHands');
}

export interface BuildObservationOptions {}

/**
 * Builds Observation for a given seat from GameState. Includes only legal info (FR-9).
 * In standard Hanabi, you see all other players' cards but not your own. visibleHands
 * therefore shows full color/value for all partner cards.
 * Does NOT include own cards. Uses deepCopy equivalent for nested structures.
 */
export function buildObservation(
  state: GameState,
  seatIndex: number,
  options?: BuildObservationOptions
): Observation {
  const visibleHands: Record<number, VisibleCard[]> = {};
  for (let p = 0; p < PLAYER_COUNT; p++) {
    if (p === seatIndex) continue;
    const hand = state.hands[p];
    visibleHands[p] = hand.map((card) => ({
      cardId: card.id,
      color: card.color,
      value: card.value,
    }));
  }

  const ownHand = state.hands[seatIndex];
  const ownCardIds = ownHand.map((c) => c.id);

  const obs: Observation = {
    visibleHands,
    ownHandSize: ownHand.length,
    ownCardIds,
    hintsRemaining: state.hintTokens,
    livesRemaining: state.lifeTokens,
    discardPile: state.discardPile.map((c) => ({ ...c })),
    playedStacks: { ...state.playedStacks },
    deckCount: state.deck.length,
    actionHistory: [...state.actionHistory],
  };
  return deepCopyObservation(obs);
}
