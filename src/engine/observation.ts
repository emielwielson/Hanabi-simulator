import type { Action } from './actions';
import { getLegalActions } from './actions';
import type { Card, Color } from './types';
import type { GameEvent } from './events';
import type { GameState } from './game-state';

/**
 * Card in another player's hand. Color and value are visible only when hinted (FR-19).
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
export interface Observation {
  currentPlayer: number;
  selfSeat: number;
  visibleHands: Record<number, VisibleCard[]>;
  ownHandSize: number;
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
  return {
    currentPlayer: obs.currentPlayer,
    selfSeat: obs.selfSeat,
    visibleHands,
    ownHandSize: obs.ownHandSize,
    hintsRemaining: obs.hintsRemaining,
    livesRemaining: obs.livesRemaining,
    discardPile: obs.discardPile.map((c) => ({ ...c })),
    playedStacks,
    deckCount: obs.deckCount,
    actionHistory: [...obs.actionHistory],
    legalActions: obs.legalActions ? obs.legalActions.map((a) => ({ ...a })) : undefined,
  };
}

/**
 * Builds Observation for a given seat from GameState. Includes only legal info (FR-9).
 * visibleHands shows other players' cards with color/value only where hinted (FR-19).
 * Does NOT include own cards. Uses deepCopy equivalent for nested structures.
 */
export function buildObservation(state: GameState, seatIndex: number): Observation {
  const visibleHands: Record<number, VisibleCard[]> = {};
  for (let p = 0; p < state.playerCount; p++) {
    if (p === seatIndex) continue;
    const hand = state.hands[p];
    visibleHands[p] = hand.map((card) => {
      const known = state.hintKnowledge.get(card.id) ?? {};
      return {
        cardId: card.id,
        color: known.color,
        value: known.value,
      };
    });
  }

  const obs: Observation = {
    currentPlayer: state.currentPlayer,
    selfSeat: seatIndex,
    visibleHands,
    ownHandSize: state.hands[seatIndex].length,
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
