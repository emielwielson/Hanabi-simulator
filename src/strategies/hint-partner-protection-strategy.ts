import type { Action } from '../engine/actions';
import { getLegalActionsFromObservation } from '../engine/actions';
import { getSelfSeat } from '../engine/observation';
import { getOwnHintKnowledge, getKnownToHolder } from './observation-knowledge';
import type { HanabiStrategy, Observation } from './types';
import type { Color } from '../engine/types';
import { DECK_COMPOSITION, COLORS } from '../engine/types';
import { getDeterministicRNG } from './observation-rng';

/**
 * HintPartner strategy with protection hints.
 * - Number hint N = "your card at position N-1 is playable"
 * - Color hint = "the first K cards from the left are protected", Red=1, Yellow=2, Green=3, Blue=4, White=5
 * - Partner model: discards leftmost; plays only when he knows (number hint or deduction)
 * - We check if partner can safely discard or play; if not, we give number hint (playable) or color hint (protection) first.
 */
export class HintPartnerProtectionStrategy implements HanabiStrategy {
  private readonly rngSeed: number;

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  getAction(observation: Observation): Action {
    const legalActions = getLegalActionsFromObservation(observation);
    const rng = getDeterministicRNG(observation, this.rngSeed);

    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
      }
      return { type: 'play', cardIndex: 0 };
    }

    const partnerSafe = this.partnerCanSafelyDiscardOrPlay(observation);

    if (partnerSafe) {
      const playSlot = this.getMyPlayableSlot(observation);
      if (playSlot !== null) {
        const playAction = legalActions.find(
          (a) => a.type === 'play' && a.cardIndex === playSlot
        );
        if (playAction) return { ...playAction };
      }

      if (observation.hintsRemaining > 0) {
        const numberHintPos = this.getPartnerPlayablePositionPartnerDoesNotKnow(
          observation
        );
        if (numberHintPos !== null) {
          const partnerSeat = 1 - getSelfSeat(observation);
          const hintAction = legalActions.find(
            (a) =>
              a.type === 'hint' &&
              a.targetPlayer === partnerSeat &&
              a.hintType === 'number' &&
              a.hintValue === numberHintPos + 1
          );
          if (hintAction) return { ...hintAction };
        }
      }

      const discardIdx = this.getMyLeftmostUnprotectedDiscardIndex(observation);
      if (
        discardIdx !== null &&
        observation.hintsRemaining < 8
      ) {
        const discardAction = legalActions.find(
          (a) => a.type === 'discard' && a.cardIndex === discardIdx
        );
        if (discardAction) return { ...discardAction };
      }
    } else {
      if (observation.hintsRemaining > 0) {
        const numberHintPos = this.getPartnerPlayablePositionPartnerDoesNotKnow(
          observation
        );
        if (numberHintPos !== null) {
          const partnerSeat = 1 - getSelfSeat(observation);
          const hintAction = legalActions.find(
            (a) =>
              a.type === 'hint' &&
              a.targetPlayer === partnerSeat &&
              a.hintType === 'number' &&
              a.hintValue === numberHintPos + 1
          );
          if (hintAction) return { ...hintAction };
        }

        const protectionHint = this.getProtectionColorHintForPartner(observation);
        if (protectionHint !== null) {
          const partnerSeat = 1 - getSelfSeat(observation);
          const hintAction = legalActions.find(
            (a) =>
              a.type === 'hint' &&
              a.targetPlayer === partnerSeat &&
              a.hintType === 'color' &&
              a.hintValue === protectionHint
          );
          if (hintAction) return { ...hintAction };
        }
      }

      const discardIdx = this.getMyLeftmostUnprotectedDiscardIndex(observation);
      if (
        discardIdx !== null &&
        observation.hintsRemaining < 8
      ) {
        const discardAction = legalActions.find(
          (a) => a.type === 'discard' && a.cardIndex === discardIdx
        );
        if (discardAction) return { ...discardAction };
      }
    }

    const idx = Math.floor(rng() * legalActions.length);
    return { ...legalActions[idx] };
  }

  private partnerCanSafelyDiscardOrPlay(observation: Observation): boolean {
    const { visibleCards, playedStacks } = observation;
    if (visibleCards.length === 0) return true;

    for (let pos = 0; pos < visibleCards.length && pos < 5; pos++) {
      const card = visibleCards[pos];
      if (card.color === undefined || card.value === undefined) continue;
      const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
      if (card.value !== nextNeeded) continue;

      const known = getKnownToHolder(observation, card.cardId);
      const knowsByNumber = known?.value === card.value;
      const knowsByDeduction =
        known?.color === card.color && known?.value === card.value;
      if (knowsByNumber || knowsByDeduction) return true;
    }

    const leftmost = visibleCards[0];
    if (leftmost.color === undefined || leftmost.value === undefined)
      return true;
    if (this.isCriticalCard(observation, leftmost.color, leftmost.value))
      return false;
    return true;
  }

  private isCriticalCard(
    observation: Observation,
    color: Color,
    value: number
  ): boolean {
    if (value === 5) return true;
    const total = DECK_COMPOSITION[value] ?? 0;
    const onStack = (observation.playedStacks[color] ?? 0) >= value ? 1 : 0;
    const inDiscard = observation.discardPile.filter(
      (c) => c.color === color && c.value === value
    ).length;
    const inVisibleCards = observation.visibleCards.filter(
      (c) => c.color === color && c.value === value
    ).length;
    const remaining = total - onStack - inDiscard - inVisibleCards;
    return remaining <= 1;
  }

  private getMyPlayableSlot(observation: Observation): number | null {
    const playFromHint = this.getPlayFromHint(observation);
    if (playFromHint !== null) return playFromHint;

    for (let slot = 0; slot < observation.ownHandSize && slot < 5; slot++) {
      const known = getOwnHintKnowledge(observation, slot);
      if (
        known?.color !== undefined &&
        known?.value !== undefined
      ) {
        const nextNeeded =
          (observation.playedStacks[known.color] ?? 0) + 1;
        if (known.value === nextNeeded) return slot;
      }
    }
    return null;
  }

  private getPlayFromHint(observation: Observation): number | null {
    for (let i = observation.actionHistory.length - 1; i >= 0; i--) {
      const ev = observation.actionHistory[i];
      if (ev.type === 'hint' && ev.targetPlayer === getSelfSeat(observation)) {
        const hintValue =
          ev.hintType === 'number' ? (ev.hintValue as number) : null;
        if (hintValue !== null && hintValue >= 1 && hintValue <= 5) {
          const position = hintValue - 1;
          if (position < observation.ownHandSize) return position;
        }
        break;
      }
      if (ev.type === 'play' || ev.type === 'discard') {
        if (ev.playerIndex === getSelfSeat(observation)) break;
      }
    }
    return null;
  }

  private getMyLeftmostUnprotectedDiscardIndex(observation: Observation): number | null {
    for (let slot = 0; slot < observation.ownHandSize && slot < 5; slot++) {
      const known = getOwnHintKnowledge(observation, slot);
      const value = known?.value;
      const color = known?.color;

      if (value === 5) continue;
      if (
        color !== undefined &&
        value !== undefined &&
        this.isCriticalCard(observation, color, value)
      ) {
        continue;
      }
      return slot;
    }
    return 0;
  }

  private getPartnerPlayablePositionPartnerDoesNotKnow(
    observation: Observation
  ): number | null {
    const { visibleCards, playedStacks } = observation;
    for (let pos = 0; pos < visibleCards.length && pos < 5; pos++) {
      const card = visibleCards[pos];
      if (card.color === undefined || card.value === undefined) continue;
      const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
      if (card.value !== nextNeeded) continue;

      const known = getKnownToHolder(observation, card.cardId);
      const knowsByNumber = known?.value === card.value;
      const knowsByDeduction =
        known?.color === card.color && known?.value === card.value;
      if (!knowsByNumber && !knowsByDeduction) return pos;
    }
    return null;
  }

  private getProtectionColorHintForPartner(observation: Observation): Color | null {
    const { visibleCards } = observation;
    let rightmostCriticalPos = -1;

    for (let pos = 0; pos < visibleCards.length && pos < 5; pos++) {
      const card = visibleCards[pos];
      if (card.color === undefined || card.value === undefined) continue;
      if (this.isCriticalCard(observation, card.color, card.value)) {
        rightmostCriticalPos = pos;
      }
    }

    if (rightmostCriticalPos < 0) return null;
    return COLORS[rightmostCriticalPos];
  }
}
