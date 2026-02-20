import { createSeededRNG } from '../engine/seeded-rng';
import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';

/**
 * HintPartner_discard variant: same as HintPartner_discard (position-encoding, hint playable cards)
 * but in the discard step we discard the rightmost card instead of the leftmost.
 */
export class HintPartnerDiscardRightStrategy implements HanabiStrategy {
  private config: GameConfig | null = null;
  private seatIndex = 0;
  private rng: (() => number) | null = null;
  private rngSeed: number;

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  initialize(config: GameConfig, seatIndex: number): void {
    this.config = config;
    this.seatIndex = seatIndex;
    this.rng = createSeededRNG(this.rngSeed + seatIndex);
  }

  onGameStart(_observation: Observation): void {
    // No-op
  }

  getAction(observation: Observation): Action {
    if (!this.rng) {
      throw new Error('Strategy not initialized');
    }

    const legalActions = observation.legalActions ?? [];
    const rightmostIndex = Math.max(0, observation.ownHandSize - 1);

    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: rightmostIndex };
      }
      return { type: 'play', cardIndex: 0 };
    }

    // 1. If we received a hint, play the card at position N-1 (position-encoding)
    const playFromHint = this.getPlayFromHint(observation);
    if (playFromHint !== null) {
      const playAction = legalActions.find(
        (a) => a.type === 'play' && a.cardIndex === playFromHint
      );
      if (playAction) return { ...playAction };
    }

    // 2. If partner has a playable card, hint it
    const hintAction = this.getHintForPlayableCard(observation);
    if (hintAction !== null && hintAction.type === 'hint') {
      const hintLegal = legalActions.find(
        (a) =>
          a.type === 'hint' &&
          a.targetPlayer === hintAction.targetPlayer &&
          a.hintType === hintAction.hintType &&
          a.hintValue === hintAction.hintValue
      );
      if (hintLegal) return { ...hintLegal };
    }

    // 3. Prefer discard rightmost; if 8 hints discard is illegal
    if (observation.hintsRemaining < 8) {
      const discardRight = legalActions.find(
        (a) => a.type === 'discard' && a.cardIndex === rightmostIndex
      );
      if (discardRight) return { ...discardRight };
    }

    // 4. At 8 hints: give a random color hint (to burn a hint token)
    if (observation.hintsRemaining >= 8) {
      const colorHintActions = legalActions.filter(
        (a) => a.type === 'hint' && a.hintType === 'color'
      );
      if (colorHintActions.length > 0) {
        const idx = Math.floor(this.rng() * colorHintActions.length);
        return { ...colorHintActions[idx] };
      }
    }

    // 5. Random legal action (fallback)
    const idx = Math.floor(this.rng() * legalActions.length);
    return { ...legalActions[idx] };
  }

  private getPlayFromHint(observation: Observation): number | null {
    for (let i = observation.actionHistory.length - 1; i >= 0; i--) {
      const ev = observation.actionHistory[i];
      if (ev.type === 'hint' && ev.targetPlayer === observation.selfSeat) {
        const hintValue = ev.hintType === 'number' ? (ev.hintValue as number) : null;
        if (hintValue !== null && hintValue >= 1 && hintValue <= 5) {
          const position = hintValue - 1;
          if (position < observation.ownHandSize) {
            return position;
          }
        }
        break;
      }
      if (ev.type === 'play' || ev.type === 'discard') {
        if (ev.playerIndex === observation.selfSeat) {
          break;
        }
      }
    }
    return null;
  }

  private getHintForPlayableCard(observation: Observation): Action | null {
    if (observation.hintsRemaining <= 0) return null;

    const { visibleHands, playedStacks } = observation;

    for (const seatStr of Object.keys(visibleHands)) {
      const targetSeat = Number(seatStr);
      if (targetSeat === observation.selfSeat) continue;
      const hand = visibleHands[targetSeat];
      if (!hand || hand.length === 0) continue;

      for (let position = 0; position < hand.length && position < 5; position++) {
        const card = hand[position];
        if (card.color === undefined || card.value === undefined) continue;
        const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
        if (card.value !== nextNeeded) continue;

        const hintValue = position + 1;
        return {
          type: 'hint',
          targetPlayer: targetSeat,
          hintType: 'number',
          hintValue,
        };
      }
    }
    return null;
  }

  onActionResolved(_event: import('../engine/events').GameEvent): void {
    // No-op
  }

  onGameEnd(_result: import('../engine/events').FinalState): void {
    // No-op
  }

  clone(): HanabiStrategy {
    return new HintPartnerDiscardRightStrategy(this.rngSeed);
  }
}
