import type { Card } from './types';
import { Color, COLORS } from './types';
import type { GameEvent, EndReason } from './events';
import { createDeck, shuffleDeck } from './deck';

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
  playerCount: number;
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
const CARDS_PER_PLAYER_2_3 = 5;
const CARDS_PER_PLAYER_4_5 = 4;

function cardsPerPlayer(playerCount: number): number {
  return playerCount <= 3 ? CARDS_PER_PLAYER_2_3 : CARDS_PER_PLAYER_4_5;
}

/**
 * Deals cards from deck. 2-3 players: 5 cards each; 4-5 players: 4 cards each.
 * Draws from front of deck. Returns hands and remaining deck.
 */
export function deal(
  deck: Card[],
  playerCount: number
): { hands: Card[][]; deck: Card[] } {
  const cardsPer = cardsPerPlayer(playerCount);
  const hands: Card[][] = [];
  let idx = 0;
  for (let p = 0; p < playerCount; p++) {
    const hand: Card[] = [];
    for (let i = 0; i < cardsPer; i++) {
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
 * Creates initial game state for a new game.
 */
export function createInitialState(
  seed: number,
  playerCount: number,
  hintTokens = MAX_HINT_TOKENS,
  lifeTokens = MAX_LIFE_TOKENS
): GameState {
  const deck = shuffleDeck(createDeck(), seed);
  const { hands, deck: remainingDeck } = deal(deck, playerCount);
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
    playerCount,
    hintKnowledge: new Map(),
  };
}
