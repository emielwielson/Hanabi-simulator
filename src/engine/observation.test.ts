import type { Observation } from './observation';
import { buildObservation, deepCopyObservation, getSelfSeat } from './observation';
import { createInitialState } from './game-state';

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
    };
    const copy = deepCopyObservation(obs);
    expect(copy).not.toBe(obs);
    expect(copy.visibleHands).not.toBe(obs.visibleHands);
    expect(copy.visibleHands[1]).not.toBe(obs.visibleHands[1]);
    expect(copy.discardPile).not.toBe(obs.discardPile);
    expect(copy.actionHistory).not.toBe(obs.actionHistory);
    expect(copy.playedStacks).not.toBe(obs.playedStacks);
  });

  it('copies knownToHolder and does not share array references', () => {
    const obs: Observation = {
      visibleHands: {
        1: [
          { cardId: 10, knownToHolder: { color: 0, excludedColors: [1, 2] } },
        ],
      },
      ownHandSize: 5,
      ownHintKnowledge: [],
      hintsRemaining: 8,
      livesRemaining: 3,
      discardPile: [],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      deckCount: 35,
      actionHistory: [],
    };
    const copy = deepCopyObservation(obs);
    expect(copy.visibleHands[1][0].knownToHolder).toEqual({
      color: 0,
      excludedColors: [1, 2],
    });
    expect(copy.visibleHands[1][0].knownToHolder).not.toBe(obs.visibleHands[1][0].knownToHolder);
    expect(copy.visibleHands[1][0].knownToHolder!.excludedColors).not.toBe(
      obs.visibleHands[1][0].knownToHolder!.excludedColors
    );
  });
});

describe('buildObservation', () => {
  it('sets knownToHolder on visible cards when state has hint knowledge for them', () => {
    const state = createInitialState(99);
    const partnerCard = state.hands[1][0];
    state.hintKnowledge.set(partnerCard.id, { color: 0, value: 1 });
    const obs = buildObservation(state, 0);
    const visiblePartnerHand = obs.visibleHands[1];
    expect(visiblePartnerHand.length).toBeGreaterThan(0);
    const firstCard = visiblePartnerHand[0];
    expect(firstCard.knownToHolder).toEqual({ color: 0, value: 1 });
  });
});
