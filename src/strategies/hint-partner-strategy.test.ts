import { HintPartnerStrategy } from './hint-partner-strategy';
import type { Observation } from './types';
import { DEFAULT_CONFIG } from '../config';
import { runSimulation } from '../simulator/runner';

function createMockObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    gameSeed: 0,
    visibleHands: { 1: [] },
    ownHandSize: 5,
    ownHintKnowledge: [{}, {}, {}, {}, {}],
    hintsRemaining: 8,
    livesRemaining: 3,
    discardPile: [],
    playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    deckCount: 35,
    actionHistory: [],
    ...overrides,
  };
}

describe('HintPartnerStrategy', () => {
  it('implements HanabiStrategy and getAction returns an action', () => {
    const strategy = new HintPartnerStrategy(123);
    const obs = createMockObservation({ gameSeed: 1 });
    const action = strategy.getAction(obs);
    expect(action).toBeDefined();
    expect(['play', 'discard', 'hint']).toContain(action.type);
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
