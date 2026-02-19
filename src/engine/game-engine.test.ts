import { runGame, calculateScore } from './game-engine';
import { ExampleStrategy } from '../strategies/example-strategy';
import { DEFAULT_CONFIG } from '../config';
import { Color } from './types';

describe('calculateScore', () => {
  it('sums played stacks up to 25', () => {
    expect(calculateScore({ [Color.Red]: 5, [Color.Yellow]: 5, [Color.Green]: 5, [Color.Blue]: 5, [Color.White]: 5 })).toBe(25);
    expect(calculateScore({ [Color.Red]: 3, [Color.Yellow]: 0, [Color.Green]: 0, [Color.Blue]: 0, [Color.White]: 0 })).toBe(3);
  });
});

describe('runGame', () => {
  it('runs to completion with example strategy', () => {
    const base = new ExampleStrategy(123);
    const strategies = [base.clone(), base.clone()];
    strategies[0].initialize(DEFAULT_CONFIG, 0);
    strategies[1].initialize(DEFAULT_CONFIG, 1);
    const result = runGame(42, 2, (obs, currentPlayer) =>
      strategies[currentPlayer].getAction(obs)
    );
    expect(result.finalState.score).toBeGreaterThanOrEqual(0);
    expect(result.finalState.score).toBeLessThanOrEqual(25);
    expect(['lives_zero', 'max_score', 'deck_empty']).toContain(result.finalState.endReason);
  });

  it('is deterministic for same seed', () => {
    const getAction = (obs: import('./observation').Observation): import('./actions').Action => {
      const actions = obs.legalActions ?? [];
      return actions[0] ?? { type: 'discard', cardIndex: 0 };
    };
    const r1 = runGame(99, 2, (obs, _) => getAction(obs));
    const r2 = runGame(99, 2, (obs, _) => getAction(obs));
    expect(r1.finalState.score).toBe(r2.finalState.score);
    expect(r1.finalState.endReason).toBe(r2.finalState.endReason);
  });
});
