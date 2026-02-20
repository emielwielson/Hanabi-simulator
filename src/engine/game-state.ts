import type { Card } from './types';
import { Color, COLORS } from './types';
import type { GameEvent, EndReason } from './events';
import { createDeck, shuffleDeck } from './deck';

/** Game is always 2 players. */
export const PLAYER_COUNT = 2;

const CARDS_PER_PLAYER = 5;

export interface GameState {
  hands: Card[][];
  playedStacks: Record<Color, number>;
  discardPile: Card[];
  hintTokens: number;
  lifeTokens: number;
  currentPlayer: number;
  deck: Card[];
  actionHistory: GameEvent[];
  gameOver: boolean;
  endReason?: EndReason;
  finalRoundStarted?: boolean;
  finalRoundTurnsLeft?: number;
  /** cardId -> known color/value from hints (FR-19); excluded* = option removal (cards that didn't match a hint) */
  hintKnowledge: Map<number, HintKnowledge>;
}

export interface HintKnowledge {
  color?: Color;
  value?: number;
  excludedColors?: Color[];
  excludedValues?: number[];
}

const MAX_HINT_TOKENS = 8;
const MAX_LIFE_TOKENS = 3;

/**
 * Deals cards from deck. 2 players, 5 cards each. Draws from front of deck.
 */
export function deal(deck: Card[]): { hands: Card[][]; deck: Card[] } {
  const hands: Card[][] = [];
  let idx = 0;
  for (let p = 0; p < PLAYER_COUNT; p++) {
    const hand: Card[] = [];
    for (let i = 0; i < CARDS_PER_PLAYER; i++) {
      hand.push(deck[idx++]);
    }
    hands.push(hand);
  }
  return { hands, deck: deck.slice(idx) };
}

function initialPlayedStacks(): Record<Color, number> {
  const stacks: Record<Color, number> = {} as Record<Color, number>;
  for (const c of COLORS) {
    stacks[c] = 0;
  }
  return stacks;
}

/**
 * Creates initial game state for a new game (2 players).
 */
export function createInitialState(
  seed: number,
  hintTokens = MAX_HINT_TOKENS,
  lifeTokens = MAX_LIFE_TOKENS
): GameState {
  const deck = shuffleDeck(createDeck(), seed);
  const { hands, deck: remainingDeck } = deal(deck);
  return {
    hands,
    playedStacks: initialPlayedStacks(),
    discardPile: [],
    hintTokens,
    lifeTokens,
    currentPlayer: 0,
    deck: remainingDeck,
    actionHistory: [],
    gameOver: false,
    hintKnowledge: new Map(),
  };
}
