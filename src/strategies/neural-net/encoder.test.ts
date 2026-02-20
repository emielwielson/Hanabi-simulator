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
    expect(ENCODER_OUTPUT_SIZE).toBe(540);
  });

  it('encodes own hint knowledge for slot 0 when hint targeted self', () => {
    const obs = createMockObservation({
      actionHistory: [
        {
          type: 'hint',
          playerIndex: 1,
          targetPlayer: 0,
          hintType: 'color',
          hintValue: 0,
          matchedCardIndices: [0],
          matchedCardIds: [10],
        },
      ],
    });
    const out = encodeObservation(obs);
    expect(out).toHaveLength(ENCODER_OUTPUT_SIZE);
    // Own hint knowledge block: indices 10..109 (5 slots × 20). Slot 0 = indices 10..29.
    const slot0Block = out.slice(10, 30);
    const hasNonZero = slot0Block.some((x) => x !== 0);
    expect(hasNonZero).toBe(true);
  });

  it('encodes partner hint knowledge when hint targeted partner card', () => {
    const obs = createMockObservation({
      visibleCards: [{ cardId: 100, color: 0, value: 1 }],
      actionHistory: [
        {
          type: 'hint',
          playerIndex: 0,
          targetPlayer: 1,
          hintType: 'color',
          hintValue: 0,
          matchedCardIndices: [0],
          matchedCardIds: [100],
        },
      ],
    });
    const out = encodeObservation(obs);
    expect(out).toHaveLength(ENCODER_OUTPUT_SIZE);
    // Partner hint knowledge block: after scalars (10) + own (100) + visibleCards (50) = 160. Indices 160..259. First card = 160..179.
    const partnerSlot0Block = out.slice(160, 180);
    const hasNonZero = partnerSlot0Block.some((x) => x !== 0);
    expect(hasNonZero).toBe(true);
  });
});
