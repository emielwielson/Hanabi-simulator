import { validateActionForObservation } from '../engine/actions';
import { Protection2Strategy } from './protection2-strategy';
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

describe('Protection2Strategy', () => {
  it('implements HanabiStrategy and getAction returns a legal action', () => {
    const strategy = new Protection2Strategy();
    const obs = createMockObservation();
    const action = strategy.getAction(obs);
    expect(action).toBeDefined();
    expect(['play', 'discard', 'hint']).toContain(action.type);
    expect(validateActionForObservation(obs, action)).toBeNull();
  });

  it('plays when we have a number hint for a playable position', () => {
    const strategy = new Protection2Strategy();
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

  it('prioritizes hinting a playable 5 over other playables (5 gives extra hint)', () => {
    const strategy = new Protection2Strategy();
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 1 },
        { cardId: 101, color: Color.Blue, value: 5 },
      ],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 4, 4: 0 },
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('number');
      expect(action.hintValue).toBe(2); // position 1 = Blue 5 (playable), not position 0 = Red 1
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives number hint when partner has playable card he does not know and partner is unsafe', () => {
    const strategy = new Protection2Strategy();
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

  it('protects all critical cards including non-5 (e.g. White 2 when other copy discarded)', () => {
    const strategy = new Protection2Strategy();
    // Partner has White 2 (critical - other in discard), Red 5, Blue 5. Need Green (protect 3), not Yellow.
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.White, value: 2 },
        { cardId: 101, color: Color.Red, value: 5 },
        { cardId: 102, color: Color.Blue, value: 5 },
      ],
      actionHistory: [],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      discardPile: [{ id: 50, color: Color.White, value: 2 }],
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('color');
      expect(action.hintValue).toBe(Color.Green); // protect 3 cards (White 2 + two 5's)
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives minimum protection (Blue not White) when pos 4 is safe and only pos 0-3 need protection', () => {
    const strategy = new Protection2Strategy();
    const actionHistory: GameEvent[] = [
      { type: 'hint', playerIndex: 0, targetPlayer: 1, hintType: 'color', hintValue: Color.Green, matchedCardIndices: [0, 1, 2], matchedCardIds: [100, 101, 102] },
    ];
    // Partner: Yellow 2 (safe), Green 5, White 3, Yellow 3 (critical), Blue 4 (safe, not playable). With Green protect 3, idx=3.
    // Card at 3 (Yellow 3) critical. Card at 4 (Blue 4) safe. Give Blue (protect 4), not White (protect 5).
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Yellow, value: 2 },
        { cardId: 101, color: Color.Green, value: 5 },
        { cardId: 102, color: Color.White, value: 3 },
        { cardId: 103, color: Color.Yellow, value: 3 },
        { cardId: 104, color: Color.Blue, value: 4 },
      ],
      actionHistory,
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      discardPile: [{ id: 50, color: Color.Yellow, value: 3 }],
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('color');
      expect(action.hintValue).toBe(Color.Blue); // protect 4, not 5 (Yellow 2 at 0 is safe)
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives protection hint when partner leftmost unprotected is critical and no playable to hint', () => {
    const strategy = new Protection2Strategy();
    const actionHistory: GameEvent[] = [
      {
        type: 'hint',
        playerIndex: 0,
        targetPlayer: 1,
        hintType: 'color',
        hintValue: Color.Yellow,
        matchedCardIndices: [0, 1],
        matchedCardIds: [100, 101],
      },
    ];
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 4 },
        { cardId: 101, color: Color.Yellow, value: 4 },
        { cardId: 102, color: Color.Green, value: 5 },
      ],
      actionHistory,
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      discardPile: [{ id: 50, color: Color.Red, value: 4 }],
      hintsRemaining: 3,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('color');
      expect(action.hintValue).toBe(Color.Green);
      expect(action.targetPlayer).toBe(1);
    }
  });

  it('gives protection hint when all our cards are protected and we have no playable (e.g. after White hint)', () => {
    const strategy = new Protection2Strategy();
    const actionHistory: GameEvent[] = [
      {
        type: 'hint',
        playerIndex: 0,
        targetPlayer: 1,
        hintType: 'color',
        hintValue: Color.White,
        matchedCardIndices: [0, 1, 2, 3, 4],
        matchedCardIds: [100, 101, 102, 103, 104],
      },
    ];
    const obs = createMockObservation({
      observerSeat: 1,
      ownHandSize: 5,
      visibleCards: [
        { cardId: 200, color: Color.Red, value: 5 },
        { cardId: 201, color: Color.Yellow, value: 5 },
        { cardId: 202, color: Color.Green, value: 5 },
      ],
      actionHistory,
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      discardPile: [],
      hintsRemaining: 5,
    });
    const action = strategy.getAction(obs);
    expect(action.type).toBe('hint');
    if (action.type === 'hint') {
      expect(action.hintType).toBe('color');
      expect(action.hintValue).toBe(Color.Green);
      expect(action.targetPlayer).toBe(0);
    }
  });

  it('uses random fallback when no preferred action (deterministic per seed)', () => {
    const strategy = new Protection2Strategy(42);
    const obs = createMockObservation({
      visibleCards: [
        { cardId: 100, color: Color.Red, value: 1 },
        { cardId: 101, color: Color.Yellow, value: 1 },
      ],
      playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      hintsRemaining: 7,
      actionHistory: [],
    });
    const action = strategy.getAction(obs);
    expect(['play', 'discard', 'hint']).toContain(action.type);
  });

  it('completes simulations', () => {
    const result = runSimulation(
      { ...DEFAULT_CONFIG, gameCount: 10 },
      ['Protection2']
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('Protection2');
    expect(result.results[0].scores).toHaveLength(10);
  });
});
