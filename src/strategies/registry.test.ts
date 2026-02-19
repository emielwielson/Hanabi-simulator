import { getStrategies } from './registry';

describe('getStrategies', () => {
  it('returns at least one strategy', () => {
    const strategies = getStrategies();
    expect(strategies.length).toBeGreaterThanOrEqual(1);
  });

  it('each entry has name and factory', () => {
    const strategies = getStrategies();
    for (const s of strategies) {
      expect(s.name).toBeDefined();
      expect(typeof s.factory).toBe('function');
      const instance = s.factory();
      expect(instance).toHaveProperty('getAction');
      expect(instance).toHaveProperty('clone');
    }
  });
});
