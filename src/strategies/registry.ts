import type { HanabiStrategy } from './types';
import { ExampleStrategy } from './example-strategy';
import { HintPartnerStrategy } from './hint-partner-strategy';

export interface StrategyEntry {
  name: string;
  factory: () => HanabiStrategy;
}

/**
 * Returns the list of available strategies for the simulator and UI.
 * Manual list per OQ-2.
 */
export function getStrategies(): StrategyEntry[] {
  return [
    {
      name: 'Random',
      factory: () => new ExampleStrategy(42),
    },
    {
      name: 'HintPartner',
      factory: () => new HintPartnerStrategy(42),
    },
  ];
}
