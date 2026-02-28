import type { HanabiStrategy } from './types';
import { ExampleStrategy } from './example-strategy';
import { HintPartnerStrategy } from './hint-partner-strategy';
import { HintPartnerDiscardStrategy } from './hint-partner-discard-strategy';
import { HintPartnerDiscardRightStrategy } from './hint-partner-discard-right-strategy';
import { HintPartnerDiscardLeftSafeStrategy } from './hint-partner-discard-left-safe-strategy';
import { HintPartnerDiscardRightSafeStrategy } from './hint-partner-discard-right-safe-strategy';
import { HintPartnerProtectionStrategy } from './hint-partner-protection-strategy';
import { Protection2Strategy } from './protection2-strategy';
import { NeuralNetStrategy } from './neural-net-strategy';

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
    {
      name: 'HintPartner_protection',
      factory: () => new HintPartnerProtectionStrategy(42),
    },
    {
      name: 'Protection2',
      factory: () => new Protection2Strategy(42),
    },
    {
      name: 'NeuralNet',
      factory: () => new NeuralNetStrategy(42),
    },
  ];
}
