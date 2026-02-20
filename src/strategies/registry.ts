import type { HanabiStrategy } from './types';
import { ExampleStrategy } from './example-strategy';
import { HintPartnerStrategy } from './hint-partner-strategy';
import { HintPartnerDiscardStrategy } from './hint-partner-discard-strategy';
import { HintPartnerDiscardRightStrategy } from './hint-partner-discard-right-strategy';
import { HintPartnerDiscardLeftSafeStrategy } from './hint-partner-discard-left-safe-strategy';
import { HintPartnerDiscardRightSafeStrategy } from './hint-partner-discard-right-safe-strategy';

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
    {
      name: 'HintPartner_discard',
      factory: () => new HintPartnerDiscardStrategy(42),
    },
    {
      name: 'HintPartner_discard_right',
      factory: () => new HintPartnerDiscardRightStrategy(42),
    },
    {
      name: 'HintPartner_discard_left_safe',
      factory: () => new HintPartnerDiscardLeftSafeStrategy(42),
    },
    {
      name: 'HintPartner_discard_right_safe',
      factory: () => new HintPartnerDiscardRightSafeStrategy(42),
    },
  ];
}
