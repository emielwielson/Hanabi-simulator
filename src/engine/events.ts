import { Card, Color } from './types';

export type PlayEvent = {
  type: 'play';
  playerIndex: number;
  cardIndex: number;
  success: boolean;
  card?: Card;
};

export type DiscardEvent = {
  type: 'discard';
  playerIndex: number;
  cardIndex: number;
  card: Card;
};

export type HintEvent = {
  type: 'hint';
  playerIndex: number;
  targetPlayer: number;
  hintType: 'color' | 'number';
  hintValue: Color | number;
  matchedCardIndices: number[];
};

export type GameEvent = PlayEvent | DiscardEvent | HintEvent;

export type EndReason = 'lives_zero' | 'max_score' | 'deck_empty';

export interface FinalState {
  score: number;
  livesRemaining: number;
  hintsRemaining: number;
  endReason: EndReason;
  playedStacks: Record<Color, number>;
  discardPile: Card[];
}
