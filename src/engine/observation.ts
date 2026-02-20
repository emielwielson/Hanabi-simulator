import type { Action } from './actions';
import { getLegalActions } from './actions';
import type { Card, Color } from './types';
import type { GameEvent } from './events';
import type { GameState } from './game-state';
import { PLAYER_COUNT } from './game-state';

/**
 * Card in another player's hand. In standard Hanabi, you see all other players' cards.
 */
export interface VisibleCard {
  cardId: number;
  color?: Color;
  value?: number;
}

/**
 * Observation passed to strategies. Engine must deep-copy before passing (FR-14).
 * legalActions is populated by buildObservation when engine provides it.
 */
/** Known color/value for one slot of own hand (from hints). */
export interface OwnSlotKnowledge {
  color?: Color;
  value?: number;
}

export interface Observation {
  currentPlayer: number;
  selfSeat: number;
  /** Game seed for deterministic RNG in stateless strategies. */
  gameSeed?: number;
  visibleHands: Record<number, VisibleCard[]>;
  ownHandSize: number;
  /** Per-slot hint knowledge for own hand (index = slot). */
  ownHintKnowledge: OwnSlotKnowledge[];
  hintsRemaining: number;
  livesRemaining: number;
  discardPile: Card[];
  playedStacks: Record<Color, number>;
  deckCount: number;
  actionHistory: GameEvent[];
  /** Legal actions for current player; populated by engine's buildObservation. */
  legalActions?: Action[];
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
  const ownHintKnowledge = obs.ownHintKnowledge.map((s) => ({ ...s }));
  return {
    currentPlayer: obs.currentPlayer,
    selfSeat: obs.selfSeat,
    gameSeed: obs.gameSeed,
    visibleHands,
    ownHandSize: obs.ownHandSize,
    ownHintKnowledge,
    hintsRemaining: obs.hintsRemaining,
    livesRemaining: obs.livesRemaining,
    discardPile: obs.discardPile.map((c) => ({ ...c })),
    playedStacks,
    deckCount: obs.deckCount,
    actionHistory: [...obs.actionHistory],
    legalActions: obs.legalActions ? obs.legalActions.map((a) => ({ ...a })) : undefined,
  };
}

export interface BuildObservationOptions {
  gameSeed?: number;
}

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
  const ownHintKnowledge: OwnSlotKnowledge[] = ownHand.map((card) => {
    const k = state.hintKnowledge.get(card.id);
    return { color: k?.color, value: k?.value };
  });

  const obs: Observation = {
    currentPlayer: state.currentPlayer,
    selfSeat: seatIndex,
    gameSeed: options?.gameSeed,
    visibleHands,
    ownHandSize: ownHand.length,
    ownHintKnowledge,
    hintsRemaining: state.hintTokens,
    livesRemaining: state.lifeTokens,
    discardPile: state.discardPile.map((c) => ({ ...c })),
    playedStacks: { ...state.playedStacks },
    deckCount: state.deck.length,
    actionHistory: [...state.actionHistory],
    legalActions: getLegalActions(state, state.currentPlayer),
  };
  return deepCopyObservation(obs);
}
