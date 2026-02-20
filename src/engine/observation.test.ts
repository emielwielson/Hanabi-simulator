import type { Observation } from './observation';
import { deepCopyObservation, getSelfSeat } from './observation';

describe('getSelfSeat', () => {
  it('returns the seat not present in visibleHands', () => {
    const obs: Observation = {
      visibleHands: { 1: [{ cardId: 10 }] },
      ownHandSize: 5,
      ownHintKnowledge: [],
      hintsRemaining: 8,
      livesRemaining: 3,
      discardPile: [],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      deckCount: 35,
      actionHistory: [],
    };
    expect(getSelfSeat(obs)).toBe(0);
  });
});

describe('deepCopyObservation', () => {
  it('returns a copy that does not share references with original', () => {
    const visibleHands: Record<number, { cardId: number }[]> = {
      1: [{ cardId: 10 }, { cardId: 11 }],
    };
    const discardPile = [{ id: 1, color: 0, value: 1 }];
    const playedStacks = { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0 };
    const obs: Observation = {
      visibleHands,
      ownHandSize: 5,
      ownHintKnowledge: [{}, {}, {}, {}, {}],
      hintsRemaining: 8,
      livesRemaining: 3,
      discardPile,
      playedStacks,
      deckCount: 35,
      actionHistory: [],
      legalActions: [{ type: 'play' as const, cardIndex: 0 }],
    };
    const copy = deepCopyObservation(obs);
    expect(copy).not.toBe(obs);
    expect(copy.visibleHands).not.toBe(obs.visibleHands);
    expect(copy.visibleHands[1]).not.toBe(obs.visibleHands[1]);
    expect(copy.discardPile).not.toBe(obs.discardPile);
    expect(copy.actionHistory).not.toBe(obs.actionHistory);
    expect(copy.playedStacks).not.toBe(obs.playedStacks);
  });
});
