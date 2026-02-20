import type { Action } from '../engine/actions';
import { getLegalActionsFromObservation } from '../engine/actions';
import { getSelfSeat } from '../engine/observation';
import type { HanabiStrategy, Observation } from './types';
import { getDeterministicRandom } from './observation-rng';

/**
 * Strategy using position-encoding convention:
 * - Hint value N (1-5) means "your card at position N-1 (left to right) is playable"
 * - Hints 1-5 are always legal (don't need to match any card)
 * - When we receive hint N, play position N-1
 * - Other moves: random
 */
export class HintPartnerStrategy implements HanabiStrategy {
  private readonly rngSeed: number;

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  getAction(observation: Observation): Action {
    const legalActions = getLegalActionsFromObservation(observation);
    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      return { type: 'play', cardIndex: 0 };
    }

    const playFromHint = this.getPlayFromHint(observation);
    if (playFromHint !== null) {
      const playAction = legalActions.find(
        (a) => a.type === 'play' && a.cardIndex === playFromHint
      );
      if (playAction) return { ...playAction };
    }

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

    const rng = getDeterministicRandom(observation, this.rngSeed);
    const idx = Math.floor(rng * legalActions.length);
    return { ...legalActions[idx] };
  }

  private getPlayFromHint(observation: Observation): number | null {
    for (let i = observation.actionHistory.length - 1; i >= 0; i--) {
      const ev = observation.actionHistory[i];
      if (ev.type === 'hint' && ev.targetPlayer === getSelfSeat(observation)) {
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
        if (ev.playerIndex === getSelfSeat(observation)) {
          break;
        }
      }
    }
    return null;
  }

  private getHintForPlayableCard(observation: Observation): Action | null {
    if (observation.hintsRemaining <= 0) return null;

    const { visibleCards, playedStacks } = observation;
    const partnerSeat = 1 - getSelfSeat(observation);
    if (!visibleCards.length) return null;

    for (let position = 0; position < visibleCards.length && position < 5; position++) {
      const card = visibleCards[position];
      if (card.color === undefined || card.value === undefined) continue;
      const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
      if (card.value !== nextNeeded) continue;

      const hintValue = position + 1;
      return {
        type: 'hint',
        targetPlayer: partnerSeat,
        hintType: 'number',
        hintValue,
      };
    }
    return null;
  }
}
