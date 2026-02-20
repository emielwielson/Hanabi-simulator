import { encodeObservation, ENCODER_OUTPUT_SIZE } from './encoder';
import type { Observation } from '../types';

function createMockObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    visibleCards: [],
    observerSeat: 0,
    ownHandSize: 5,
    ownCardIds: [10, 20, 30, 40, 50],
    hintsRemaining: 8,
    livesRemaining: 3,
    discardPile: [],
    playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    deckCount: 35,
    actionHistory: [],
    ...overrides,
  };
}

describe('encodeObservation', () => {
  it('returns vector of length ENCODER_OUTPUT_SIZE', () => {
    const obs = createMockObservation();
    const out = encodeObservation(obs);
    expect(out).toHaveLength(ENCODER_OUTPUT_SIZE);
    expect(ENCODER_OUTPUT_SIZE).toBe(58);
  });

  it('encodes visibleCards in first 50 elements', () => {
    const obs = createMockObservation({
      visibleCards: [{ cardId: 1, color: 0, value: 1 }],
    });
    const out = encodeObservation(obs);
    expect(out).toHaveLength(ENCODER_OUTPUT_SIZE);
    const firstCard = out.slice(0, 10);
    expect(firstCard.some((x) => x !== 0)).toBe(true);
  });
});
