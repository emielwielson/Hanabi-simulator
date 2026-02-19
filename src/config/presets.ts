import { createDefaultConfig } from './index';
import type { GameConfig } from './index';

export interface ConfigPreset {
  id: string;
  label: string;
  config: GameConfig;
}

export const CONFIG_PRESETS: ConfigPreset[] = [
  { id: 'default', label: 'Default (2p, 1k games)', config: createDefaultConfig() },
  { id: 'quick', label: 'Quick (2p, 100 games)', config: createDefaultConfig({ gameCount: 100 }) },
  {
    id: '4p',
    label: '4 players (500 games)',
    config: createDefaultConfig({ playerCount: 4, gameCount: 500 }),
  },
  {
    id: 'debug',
    label: 'Debug (2p, 10 games, full traces)',
    config: createDefaultConfig({ gameCount: 10, loggingMode: 'debug' }),
  },
];
