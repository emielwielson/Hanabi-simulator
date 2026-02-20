import { createDefaultConfig } from './index';
import type { GameConfig } from './index';

export interface ConfigPreset {
  id: string;
  label: string;
  config: GameConfig;
}

export const CONFIG_PRESETS: ConfigPreset[] = [
  { id: 'default', label: 'Default (1k games)', config: createDefaultConfig() },
  { id: 'quick', label: 'Quick (100 games)', config: createDefaultConfig({ gameCount: 100 }) },
  {
    id: '100k',
    label: '100k games',
    config: createDefaultConfig({ gameCount: 100_000 }),
  },
  {
    id: 'debug',
    label: 'Debug (10 games, full traces)',
    config: createDefaultConfig({ gameCount: 10, loggingMode: 'debug' }),
  },
];
