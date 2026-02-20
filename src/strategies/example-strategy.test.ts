import { ExampleStrategy } from './example-strategy';
import type { Observation } from './types';
import { DEFAULT_CONFIG } from '../config';

function createMockObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    currentPlayer: 0,
    selfSeat: 0,
    gameSeed: 0,
    visibleHands: {},
    ownHandSize: 5,
    ownHintKnowledge: [{}, {}, {}, {}, {}],
    hintsRemaining: 8,
    livesRemaining: 3,
    discardPile: [],
    playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    deckCount: 35,
    actionHistory: [],
    legalActions: [
      { type: 'play', cardIndex: 0 },
      { type: 'discard', cardIndex: 0 },
    ],
    ...overrides,
  };
}

describe('ExampleStrategy', () => {
  it('getAction returns a legal action when legalActions provided', () => {
    const strategy = new ExampleStrategy(999);
    const obs = createMockObservation({
      gameSeed: 1,
      legalActions: [
        { type: 'play', cardIndex: 2 },
        { type: 'discard', cardIndex: 1 },
      ],
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBeDefined();
    expect(['play', 'discard']).toContain(action.type);
    if (action.type === 'play') expect(action.cardIndex).toBe(2);
    if (action.type === 'discard') expect(action.cardIndex).toBe(1);
  });

  it('getAction is deterministic for same observation and strategy seed', () => {
    const obs = createMockObservation({
      gameSeed: 42,
      legalActions: [{ type: 'play', cardIndex: 0 }],
    });
    const s1 = new ExampleStrategy(42);
    const a1 = s1.getAction(obs);
    const s2 = new ExampleStrategy(42);
    const a2 = s2.getAction(obs);
    expect(a1).toEqual(a2);
  });
});
