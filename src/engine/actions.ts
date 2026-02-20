import { Color, COLORS } from './types';
import type { GameState } from './game-state';
import { PLAYER_COUNT } from './game-state';
import type { Observation } from './observation';
import { getSelfSeat } from './observation';

export type PlayAction = {
  type: 'play';
  cardIndex: number;
};

export type DiscardAction = {
  type: 'discard';
  cardIndex: number;
};

export type HintAction = {
  type: 'hint';
  targetPlayer: number;
  hintType: 'color' | 'number';
  hintValue: Color | number;
};

export type Action = PlayAction | DiscardAction | HintAction;

export function validateAction(state: GameState, action: Action): string | null {
  const hand = state.hands[state.currentPlayer];
  const handSize = hand.length;

  if (action.type === 'play') {
    if (action.cardIndex < 0 || action.cardIndex >= handSize) {
      return `Invalid play: cardIndex ${action.cardIndex} out of range [0, ${handSize - 1}]`;
    }
    return null;
  }

  if (action.type === 'discard') {
    if (action.cardIndex < 0 || action.cardIndex >= handSize) {
      return `Invalid discard: cardIndex ${action.cardIndex} out of range [0, ${handSize - 1}]`;
    }
    if (state.hintTokens >= 8) {
      return 'Cannot discard: already at max hint tokens';
    }
    return null;
  }

  if (action.type === 'hint') {
    if (state.hintTokens <= 0) {
      return 'Cannot hint: no hint tokens remaining';
    }
    if (action.targetPlayer === state.currentPlayer) {
      return 'Cannot hint: cannot hint yourself';
    }
    if (action.targetPlayer < 0 || action.targetPlayer >= PLAYER_COUNT) {
      return `Invalid hint: targetPlayer ${action.targetPlayer} out of range`;
    }
    const targetHand = state.hands[action.targetPlayer];
    if (action.hintType === 'number' && typeof action.hintValue === 'number') {
      // Position-encoding: number hints 1-5 are always legal (encode slot index)
      if (action.hintValue < 1 || action.hintValue > 5) {
        return `Invalid hint: number hint must be 1-5, got ${action.hintValue}`;
      }
    } else {
      const hasMatch = targetHand.some((card) => {
        if (action.hintType === 'color') {
          return card.color === action.hintValue;
        }
        return card.value === action.hintValue;
      });
      if (!hasMatch) {
        return 'Invalid hint: no matching cards in target hand';
      }
    }
    return null;
  }

  return null;
}

export function getLegalActions(state: GameState, seatIndex: number): Action[] {
  const actions: Action[] = [];
  const hand = state.hands[seatIndex];
  const handSize = hand.length;

  for (let i = 0; i < handSize; i++) {
    actions.push({ type: 'play', cardIndex: i });
  }
  if (state.hintTokens < 8) {
    for (let i = 0; i < handSize; i++) {
      actions.push({ type: 'discard', cardIndex: i });
    }
  }
  if (state.hintTokens > 0) {
    for (let target = 0; target < PLAYER_COUNT; target++) {
      if (target === seatIndex) continue;
      const targetHand = state.hands[target];
      for (const color of COLORS) {
        if (targetHand.some((c) => c.color === color)) {
          actions.push({ type: 'hint', targetPlayer: target, hintType: 'color', hintValue: color });
        }
      }
      for (let value = 1; value <= 5; value++) {
        // Number hints 1-5 are always legal (position-encoding convention)
        actions.push({ type: 'hint', targetPlayer: target, hintType: 'number', hintValue: value });
      }
    }
  }
  return actions;
}

/**
 * Validates an action using only observation data. Strategies can call this to check
 * if an action is valid before returning it. Returns an error string or null if valid.
 */
export function validateActionForObservation(
  observation: Observation,
  action: Action
): string | null {
  const handSize = observation.ownHandSize;
  const selfSeat = getSelfSeat(observation);

  if (action.type === 'play') {
    if (action.cardIndex < 0 || action.cardIndex >= handSize) {
      return `Invalid play: cardIndex ${action.cardIndex} out of range [0, ${handSize - 1}]`;
    }
    return null;
  }

  if (action.type === 'discard') {
    if (action.cardIndex < 0 || action.cardIndex >= handSize) {
      return `Invalid discard: cardIndex ${action.cardIndex} out of range [0, ${handSize - 1}]`;
    }
    if (observation.hintsRemaining >= 8) {
      return 'Cannot discard: already at max hint tokens';
    }
    return null;
  }

  if (action.type === 'hint') {
    if (observation.hintsRemaining <= 0) {
      return 'Cannot hint: no hint tokens remaining';
    }
    if (action.targetPlayer === selfSeat) {
      return 'Cannot hint: cannot hint yourself';
    }
    if (action.targetPlayer < 0 || action.targetPlayer >= PLAYER_COUNT) {
      return `Invalid hint: targetPlayer ${action.targetPlayer} out of range`;
    }
    const targetHand = observation.visibleHands[action.targetPlayer] ?? [];
    if (action.hintType === 'number' && typeof action.hintValue === 'number') {
      if (action.hintValue < 1 || action.hintValue > 5) {
        return `Invalid hint: number hint must be 1-5, got ${action.hintValue}`;
      }
    } else {
      const hasMatch = targetHand.some((card) => {
        if (action.hintType === 'color') {
          return card.color === action.hintValue;
        }
        return card.value === action.hintValue;
      });
      if (!hasMatch) {
        return 'Invalid hint: no matching cards in target hand';
      }
    }
    return null;
  }

  return null;
}

/**
 * Returns the list of legal actions for the observer, derived from observation only.
 * Strategies can use this to choose from valid actions without having game state.
 */
export function getLegalActionsFromObservation(observation: Observation): Action[] {
  const actions: Action[] = [];
  const handSize = observation.ownHandSize;
  const selfSeat = getSelfSeat(observation);

  for (let i = 0; i < handSize; i++) {
    actions.push({ type: 'play', cardIndex: i });
  }
  if (observation.hintsRemaining < 8) {
    for (let i = 0; i < handSize; i++) {
      actions.push({ type: 'discard', cardIndex: i });
    }
  }
  if (observation.hintsRemaining > 0) {
    for (let target = 0; target < PLAYER_COUNT; target++) {
      if (target === selfSeat) continue;
      const targetHand = observation.visibleHands[target] ?? [];
      for (const color of COLORS) {
        if (targetHand.some((c) => c.color === color)) {
          actions.push({ type: 'hint', targetPlayer: target, hintType: 'color', hintValue: color });
        }
      }
      for (let value = 1; value <= 5; value++) {
        actions.push({ type: 'hint', targetPlayer: target, hintType: 'number', hintValue: value });
      }
    }
  }
  return actions;
}
