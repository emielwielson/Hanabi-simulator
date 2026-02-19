import { HintPartnerDeductionStrategy } from './hint-partner-deduction-strategy';
import { runSimulation } from '../simulator/runner';
import { createDefaultConfig } from '../config';

describe('HintPartnerDeductionStrategy', () => {
  it('implements full strategy interface', () => {
    const strategy = new HintPartnerDeductionStrategy(42);
    expect(strategy.initialize).toBeDefined();
    expect(strategy.getAction).toBeDefined();
    expect(strategy.clone).toBeDefined();
  });

  it('runs without crashing', () => {
    const config = createDefaultConfig({ gameCount: 10 });
    const result = runSimulation(config, ['HintPartnerDeduction']);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('HintPartnerDeduction');
    expect(result.results[0].scores).toHaveLength(10);
  });

  it('is registered', () => {
    const { getStrategies } = require('./registry');
    const strategies = getStrategies();
    const found = strategies.find((s: { name: string }) => s.name === 'HintPartnerDeduction');
    expect(found).toBeDefined();
  });
});
