import { runGame, calculateScore, executeAction } from './game-engine';
import { getLegalActionsFromObservation } from './actions';
import { ExampleStrategy } from '../strategies/example-strategy';
import { Color } from './types';
import { createInitialState } from './game-state';

describe('calculateScore', () => {
  it('sums played stacks up to 25', () => {
    expect(calculateScore({ [Color.Red]: 5, [Color.Yellow]: 5, [Color.Green]: 5, [Color.Blue]: 5, [Color.White]: 5 })).toBe(25);
    expect(calculateScore({ [Color.Red]: 3, [Color.Yellow]: 0, [Color.Green]: 0, [Color.Blue]: 0, [Color.White]: 0 })).toBe(3);
  });
});

describe('runGame', () => {
  it('runs to completion with example strategy', () => {
    const strategy = new ExampleStrategy(123);
    const result = runGame(42, (obs) => strategy.getAction(obs));
    expect(result.finalState.score).toBeGreaterThanOrEqual(0);
    expect(result.finalState.score).toBeLessThanOrEqual(25);
    expect(['lives_zero', 'max_score', 'deck_empty']).toContain(result.finalState.endReason);
  });

  it('is deterministic for same seed', () => {
    const getAction = (obs: import('./observation').Observation): import('./actions').Action => {
      const actions = getLegalActionsFromObservation(obs);
      return actions[0] ?? { type: 'discard', cardIndex: 0 };
    };
    const r1 = runGame(99, (obs) => getAction(obs));
    const r2 = runGame(99, (obs) => getAction(obs));
    expect(r1.finalState.score).toBe(r2.finalState.score);
    expect(r1.finalState.endReason).toBe(r2.finalState.endReason);
  });

  it('throws when strategy returns invalid action', () => {
    const state = createInitialState(42);
    expect(() => {
      executeAction(state, { type: 'play', cardIndex: 99 });
    }).toThrow(/Invalid play/);
  });
});
