export type LoggingMode = 'normal' | 'debug';

export interface GameConfig {
  playerCount: number;
  hintTokens: number;
  lifeTokens: number;
  gameCount: number;
  seedList: number[];
  loggingMode: LoggingMode;
}

export const DEFAULT_CONFIG: GameConfig = {
  playerCount: 2,
  hintTokens: 8,
  lifeTokens: 3,
  gameCount: 1000,
  seedList: [],
  loggingMode: 'normal',
};

export function createDefaultConfig(overrides?: Partial<GameConfig>): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
