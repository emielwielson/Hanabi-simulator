import { getOwnHintKnowledge, getKnownToHolder } from './observation-knowledge';
import type { Observation } from './types';

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

describe('getOwnHintKnowledge', () => {
  it('returns undefined for out-of-range slot', () => {
    const obs = createMockObservation();
    expect(getOwnHintKnowledge(obs, -1)).toBeUndefined();
    expect(getOwnHintKnowledge(obs, 5)).toBeUndefined();
  });

  it('returns undefined when no hint events target self', () => {
    const obs = createMockObservation();
    expect(getOwnHintKnowledge(obs, 0)).toBeUndefined();
  });

  it('returns color and value when hint events targeted that card', () => {
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
        {
          type: 'hint',
          playerIndex: 1,
          targetPlayer: 0,
          hintType: 'number',
          hintValue: 1,
          matchedCardIndices: [0],
          matchedCardIds: [10],
        },
      ],
    });
    const knowledge = getOwnHintKnowledge(obs, 0);
    expect(knowledge).toEqual({ color: 0, value: 1 });
  });

  it('returns excludedColors when card did not match a color hint', () => {
    const obs = createMockObservation({
      actionHistory: [
        {
          type: 'hint',
          playerIndex: 1,
          targetPlayer: 0,
          hintType: 'color',
          hintValue: 1,
          matchedCardIndices: [1],
          matchedCardIds: [20],
        },
      ],
    });
    const knowledge = getOwnHintKnowledge(obs, 0);
    expect(knowledge?.excludedColors).toContain(1);
  });
});

describe('getKnownToHolder', () => {
  it('returns undefined when cardId not in visible cards', () => {
    const obs = createMockObservation({
      visibleCards: [{ cardId: 100, color: 0, value: 1 }],
    });
    expect(getKnownToHolder(obs, 999)).toBeUndefined();
  });

  it('returns knowledge when hint events targeted that card', () => {
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
    const knowledge = getKnownToHolder(obs, 100);
    expect(knowledge).toEqual({ color: 0 });
  });
});
