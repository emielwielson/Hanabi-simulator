import { Color, COLORS } from './types';
import type { GameState } from './game-state';

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
    if (action.targetPlayer < 0 || action.targetPlayer >= state.playerCount) {
      return `Invalid hint: targetPlayer ${action.targetPlayer} out of range`;
    }
    const targetHand = state.hands[action.targetPlayer];
    const hasMatch = targetHand.some((card) => {
      if (action.hintType === 'color') {
        return card.color === action.hintValue;
      }
      return card.value === action.hintValue;
    });
    if (!hasMatch) {
      return 'Invalid hint: no matching cards in target hand';
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
    for (let target = 0; target < state.playerCount; target++) {
      if (target === seatIndex) continue;
      const targetHand = state.hands[target];
      for (const color of COLORS) {
        if (targetHand.some((c) => c.color === color)) {
          actions.push({ type: 'hint', targetPlayer: target, hintType: 'color', hintValue: color });
        }
      }
      for (let value = 1; value <= 5; value++) {
        if (targetHand.some((c) => c.value === value)) {
          actions.push({ type: 'hint', targetPlayer: target, hintType: 'number', hintValue: value });
        }
      }
    }
  }
  return actions;
}
