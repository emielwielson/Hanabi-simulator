import { Color } from './types';

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
