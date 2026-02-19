import { HintPartnerStrategy } from './hint-partner-strategy';
import { DEFAULT_CONFIG } from '../config';
import { runSimulation } from '../simulator/runner';

describe('HintPartnerStrategy', () => {
  it('implements HanabiStrategy and runs without error', () => {
    const strategy = new HintPartnerStrategy(123);
    strategy.initialize(DEFAULT_CONFIG, 0);
    expect(strategy.clone()).toBeInstanceOf(HintPartnerStrategy);
  });

  it('completes simulations', () => {
    const result = runSimulation(
      { ...DEFAULT_CONFIG, gameCount: 10 },
      ['HintPartner']
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('HintPartner');
    expect(result.results[0].scores).toHaveLength(10);
  });
});
