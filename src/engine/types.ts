export enum Color {
  Red = 0,
  Yellow = 1,
  Green = 2,
  Blue = 3,
  White = 4,
}

export interface Card {
  id: number;
  color: Color;
  value: number;
}

export const DECK_COMPOSITION: Record<number, number> = {
  1: 3,
  2: 2,
  3: 2,
  4: 2,
  5: 1,
};

export const COLORS: Color[] = [
  Color.Red,
  Color.Yellow,
  Color.Green,
  Color.Blue,
  Color.White,
];
