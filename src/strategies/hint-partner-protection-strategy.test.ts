import { validateActionForObservation } from '../engine/actions';
import { HintPartnerProtectionStrategy } from './hint-partner-protection-strategy';
import type { Observation } from './types';
import type { GameEvent } from '../engine/events';
import { Color } from '../engine/types';
import { DEFAULT_CONFIG } from '../config';
import { runSimulation } from '../simulator/runner';

function createMockObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    visibleCards: [],
    observerSeat: 0,
    ownHandSize: 5,
    ownCardIds: [1, 2, 3, 4, 5],
    hintsRemaining: 8,
    livesRemaining: 3,
    discardPile: [],
    playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    deckCount: 35,
    actionHistory: [],
    ...overrides,
  };
}

describe('HintPartnerProtectionStrategy', () => {
  it('implements HanabiStrategy and getAction returns a legal action', () => {
    const strategy = new HintPartnerProtectionStrategy(42);
    const obs = createMockObservation();
    const action = strategy.getAction(obs);
    expect(action).toBeDefined();
    expect(['play', 'discard', 'hint']).toContain(action.type);
    expect(validateActionForObservation(obs, action)).toBeNull();
  });

  it('plays when we have a number hint for a playable position', () => {
    const strategy = new HintPartnerProtectionStrategy(42);
    const actionHistory: GameEvent[] = [
      {
        type: 'hint',
        playerIndex: 0,
        targetPlayer: 1,
        hintType: 'number',
        hintValue: 1,
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
        matchedCardIds: [1],
      },
    ];
    const obs = createMockObservation({
      visibleCards: [{ cardId: 10, color: Color.Red, value: 1 }],
      actionHistory,
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('play');
    if (action.type === 'play') expect(action.cardIndex).toBe(0);
  });

  it('gives number hint when partner has playable card he does not know', () => {
    const strategy = new HintPartnerProtectionStrategy(42);
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 5 },
        { cardId: 101, color: Color.Red, value: 1 },
      ],
      playedStacks: { 0: 4, 1: 0, 2: 0, 3: 0, 4: 0 },
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('number');
      expect(action.hintValue).toBe(1);
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives number hint when partnerSafe and partner has playable 1 at position 0', () => {
    const strategy = new HintPartnerProtectionStrategy(42);
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 1 },
        { cardId: 101, color: Color.Yellow, value: 4 },
        { cardId: 102, color: Color.Green, value: 1 },
      ],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      hintsRemaining: 8,
      actionHistory: [],
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('number');
      expect(action.hintValue).toBe(1);
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives color hint when partner leftmost is critical and no playable to hint', () => {
    const strategy = new HintPartnerProtectionStrategy(42);
    // Partner has Red 4, Green 4, Blue 4. One of each discarded → all critical (last copy).
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 4 },
        { cardId: 101, color: Color.Green, value: 4 },
        { cardId: 102, color: Color.Blue, value: 4 },
      ],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      discardPile: [
        { id: 50, color: Color.Red, value: 4 },
        { id: 51, color: Color.Green, value: 4 },
        { id: 52, color: Color.Blue, value: 4 },
      ],
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('color');
      expect(action.hintValue).toBe(Color.Green); // protects 3 cards (rightmost critical at pos 2)
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('completes simulations', () => {
    const result = runSimulation(
      { ...DEFAULT_CONFIG, gameCount: 10 },
      ['HintPartner_protection']
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('HintPartner_protection');
    expect(result.results[0].scores).toHaveLength(10);
  });
});
