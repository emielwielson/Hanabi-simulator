import type { Card } from './types';
import { Color, COLORS } from './types';
import type { Action } from './actions';
import type { GameEvent, EndReason } from './events';
import type { GameState } from './game-state';
import { PLAYER_COUNT, createInitialState } from './game-state';
import { validateAction } from './actions';
import { buildObservation } from './observation';
import type { Observation } from './observation';

const MAX_HINT_TOKENS = 8;
const MAX_SCORE = 25;

export function calculateScore(playedStacks: Record<Color, number>): number {
  let score = 0;
  for (const c of COLORS) {
    score += playedStacks[c] ?? 0;
  }
  return Math.min(score, MAX_SCORE);
}

function drawCard(state: GameState, playerIndex: number): void {
  if (state.deck.length > 0) {
    state.hands[playerIndex].push(state.deck.shift()!);
  }
}

function advancePlayer(state: GameState): void {
  state.currentPlayer = (state.currentPlayer + 1) % PLAYER_COUNT;
}

function checkGameEnd(state: GameState): void {
  if (state.lifeTokens <= 0) {
    state.gameOver = true;
    state.endReason = 'lives_zero';
    return;
  }
  if (calculateScore(state.playedStacks) === MAX_SCORE) {
    state.gameOver = true;
    state.endReason = 'max_score';
    return;
  }
  if (state.finalRoundStarted && (state.finalRoundTurnsLeft ?? 0) <= 0) {
    state.gameOver = true;
    state.endReason = 'deck_empty';
  }
}

export function executeAction(state: GameState, action: Action): GameEvent {
  const err = validateAction(state, action);
  if (err) {
    throw new Error(err);
  }

  const playerIndex = state.currentPlayer;
  const hand = state.hands[playerIndex];
  let event: GameEvent;

  if (action.type === 'play') {
    const card = hand.splice(action.cardIndex, 1)[0];
    const nextValue = (state.playedStacks[card.color] ?? 0) + 1;
    const success = card.value === nextValue;

    if (success) {
      state.playedStacks[card.color] = card.value;
      if (card.value === 5 && state.hintTokens < MAX_HINT_TOKENS) {
        state.hintTokens++;
      }
      event = {
        type: 'play',
        playerIndex,
        cardIndex: action.cardIndex,
        success: true,
        card,
      };
    } else {
      state.lifeTokens--;
      state.discardPile.push(card);
      event = {
        type: 'play',
        playerIndex,
        cardIndex: action.cardIndex,
        success: false,
        card,
      };
    }
    drawCard(state, playerIndex);
  } else if (action.type === 'discard') {
    const card = hand.splice(action.cardIndex, 1)[0];
    state.discardPile.push(card);
    if (state.hintTokens < MAX_HINT_TOKENS) {
      state.hintTokens++;
    }
    event = {
      type: 'discard',
      playerIndex,
      cardIndex: action.cardIndex,
      card,
    };
    drawCard(state, playerIndex);
  } else {
    state.hintTokens--;
    const targetHand = state.hands[action.targetPlayer];
    const matchedCardIndices: number[] = [];
    const matchedCardIds: number[] = [];
    targetHand.forEach((card, idx) => {
      const matches =
        action.hintType === 'color'
          ? card.color === action.hintValue
          : card.value === action.hintValue;
      if (matches) {
        matchedCardIndices.push(idx);
        matchedCardIds.push(card.id);
        const known = state.hintKnowledge.get(card.id) ?? {};
        if (action.hintType === 'color') {
          known.color = action.hintValue as Color;
        } else {
          known.value = action.hintValue as number;
        }
        state.hintKnowledge.set(card.id, known);
      } else {
        // Option removal: cards that don't match can no longer be that color/number
        const known = state.hintKnowledge.get(card.id) ?? {};
        if (action.hintType === 'color') {
          if (known.color === undefined) {
            const excluded = known.excludedColors ?? [];
            const val = action.hintValue as Color;
            if (!excluded.includes(val)) {
              known.excludedColors = [...excluded, val];
              state.hintKnowledge.set(card.id, known);
            }
          }
        } else {
          if (known.value === undefined) {
            const excluded = known.excludedValues ?? [];
            const val = action.hintValue as number;
            if (!excluded.includes(val)) {
              known.excludedValues = [...excluded, val];
              state.hintKnowledge.set(card.id, known);
            }
          }
        }
      }
    });
    event = {
      type: 'hint',
      playerIndex,
      targetPlayer: action.targetPlayer,
      hintType: action.hintType,
      hintValue: action.hintValue,
      matchedCardIndices,
      matchedCardIds,
    };
  }

  state.actionHistory.push(event);
  advancePlayer(state);

  if (!state.finalRoundStarted && state.deck.length === 0) {
    state.finalRoundStarted = true;
    state.finalRoundTurnsLeft = PLAYER_COUNT;
  }
  if (state.finalRoundStarted) {
    state.finalRoundTurnsLeft = (state.finalRoundTurnsLeft ?? PLAYER_COUNT) - 1;
  }
  checkGameEnd(state);
  return event;
}

export interface RunGameResult {
  finalState: {
    score: number;
    livesRemaining: number;
    hintsRemaining: number;
    endReason: EndReason;
    playedStacks: Record<Color, number>;
    discardPile: Card[];
  };
  events: GameEvent[];
}

export function runGame(
  seed: number,
  getAction: (obs: Observation) => Action
): RunGameResult {
  const state = createInitialState(seed);

  while (!state.gameOver) {
    const obs = buildObservation(state, state.currentPlayer);
    const action = getAction(obs);
    executeAction(state, action);
  }

  return {
    finalState: {
      score: calculateScore(state.playedStacks),
      livesRemaining: state.lifeTokens,
      hintsRemaining: state.hintTokens,
      endReason: state.endReason!,
      playedStacks: { ...state.playedStacks },
      discardPile: [...state.discardPile],
    },
    events: [...state.actionHistory],
  };
}
