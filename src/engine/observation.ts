import type { Card, Color } from './types';
import type { GameEvent } from './events';
import type { GameState } from './game-state';

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
  /** Partner's hand (the only other player's cards in 2-player). */
  visibleCards: VisibleCard[];
  /** Seat index of the observer (the player this observation is for). */
  observerSeat: number;
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
  const playedStacks: Record<number, number> = { ...obs.playedStacks };
  return {
    visibleCards: obs.visibleCards.map((c) => ({ ...c })),
    observerSeat: obs.observerSeat,
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
 */
export function getSelfSeat(observation: Observation): number {
  return observation.observerSeat;
}

export interface BuildObservationOptions {}

/**
 * Builds Observation for a given seat from GameState. Includes only legal info (FR-9).
 * In 2-player, visibleCards is the partner's hand (full color/value). Does NOT include own cards.
 */
export function buildObservation(
  state: GameState,
  seatIndex: number,
  options?: BuildObservationOptions
): Observation {
  const partnerSeat = 1 - seatIndex;
  const visibleCards = state.hands[partnerSeat].map((card) => ({
    cardId: card.id,
    color: card.color,
    value: card.value,
  }));

  const ownHand = state.hands[seatIndex];
  const ownCardIds = ownHand.map((c) => c.id);

  const obs: Observation = {
    visibleCards,
    observerSeat: seatIndex,
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
