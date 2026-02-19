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
