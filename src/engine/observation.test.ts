import type { Observation } from './observation';
import { buildObservation, deepCopyObservation, getSelfSeat } from './observation';
import { createInitialState } from './game-state';

describe('getSelfSeat', () => {
  it('returns observerSeat', () => {
    const obs: Observation = {
      visibleCards: [{ cardId: 10 }],
      observerSeat: 0,
      ownHandSize: 5,
      ownCardIds: [1, 2, 3, 4, 5],
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
    const visibleCards = [{ cardId: 10 }, { cardId: 11 }];
    const discardPile = [{ id: 1, color: 0, value: 1 }];
    const playedStacks = { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0 };
    const obs: Observation = {
      visibleCards,
      observerSeat: 0,
      ownHandSize: 5,
      ownCardIds: [10, 11, 12, 13, 14],
      hintsRemaining: 8,
      livesRemaining: 3,
      discardPile,
      playedStacks,
      deckCount: 35,
      actionHistory: [],
    };
    const copy = deepCopyObservation(obs);
    expect(copy).not.toBe(obs);
    expect(copy.visibleCards).not.toBe(obs.visibleCards);
    expect(copy.visibleCards[0]).not.toBe(obs.visibleCards[0]);
    expect(copy.discardPile).not.toBe(obs.discardPile);
    expect(copy.actionHistory).not.toBe(obs.actionHistory);
    expect(copy.playedStacks).not.toBe(obs.playedStacks);
    expect(copy.ownCardIds).not.toBe(obs.ownCardIds);
    expect(copy.ownCardIds).toEqual(obs.ownCardIds);
  });
});

describe('buildObservation', () => {
  it('sets ownCardIds with card IDs for the observer hand', () => {
    const state = createInitialState(99);
    const obs = buildObservation(state, 0);
    expect(obs.ownCardIds).toHaveLength(obs.ownHandSize);
    expect(obs.ownCardIds).toEqual(state.hands[0].map((c) => c.id));
  });

  it('visibleCards are cardId, color, value only (knowledge via getKnownToHolder)', () => {
    const state = createInitialState(99);
    const obs = buildObservation(state, 0);
    for (const card of obs.visibleCards) {
      expect(Object.keys(card).sort()).toEqual(['cardId', 'color', 'value']);
    }
  });
});
