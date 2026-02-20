import { validateActionForObservation } from '../engine/actions';
import { ExampleStrategy } from './example-strategy';
import type { Observation } from './types';

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

describe('ExampleStrategy', () => {
  it('getAction returns a legal action', () => {
    const strategy = new ExampleStrategy(999);
    const obs = createMockObservation({ gameSeed: 1 });
    const action = strategy.getAction(obs);
    expect(action.type).toBeDefined();
    expect(['play', 'discard', 'hint']).toContain(action.type);
    expect(validateActionForObservation(obs, action)).toBeNull();
  });

  it('getAction is deterministic for same observation and strategy seed', () => {
    const obs = createMockObservation({ gameSeed: 42 });
    const s1 = new ExampleStrategy(42);
    const a1 = s1.getAction(obs);
    const s2 = new ExampleStrategy(42);
    const a2 = s2.getAction(obs);
    expect(a1).toEqual(a2);
  });
});
