import type { Action } from '../engine/actions';
import { getLegalActionsFromObservation } from '../engine/actions';
import { getSelfSeat } from '../engine/observation';
import { getOwnHintKnowledge, getKnownToHolder } from './observation-knowledge';
import type { HanabiStrategy, Observation } from './types';
import { Color, DECK_COMPOSITION, COLORS } from '../engine/types';
import { getDeterministicRNG } from './observation-rng';

/**
 * Protection2 strategy.
 * - Number hint N = "your card at position N-1 is playable"
 * - Color hint = "the first K cards from the left are protected", Red=1, Yellow=2, Green=3, Blue=4, White=5
 * - Partner model: discards leftmost UNPROTECTED card; plays only when he knows (number hint or deduction)
 * - PartnerSafe: play, discard unprotected, discard leftmost with risk
 * - PartnerUnsafe: number hint, protection hint, discard unprotected
 * - Fallback: discard leftmost (never random)
 * - No data leakage: uses only Observation
 */
export class Protection2Strategy implements HanabiStrategy {
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

      let discardIdx = this.getMyLeftmostUnprotectedDiscardIndex(observation);
      if (discardIdx === null && this.getMyProtectedCount(observation) >= observation.ownHandSize && observation.ownHandSize > 0) {
        discardIdx = observation.ownHandSize - 1;
      }
      if (
        discardIdx !== null &&
        observation.hintsRemaining < 8
      ) {
        const discardAction = legalActions.find(
          (a) => a.type === 'discard' && a.cardIndex === discardIdx
        );
        if (discardAction) return { ...discardAction };
      }

      if (observation.hintsRemaining < 8 && observation.ownHandSize > 0) {
        const firstUnprotected = this.getMyProtectedCount(observation);
        if (firstUnprotected < observation.ownHandSize) {
          const discardAction = legalActions.find(
            (a) => a.type === 'discard' && a.cardIndex === firstUnprotected
          );
          if (discardAction) return { ...discardAction };
        }
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
      }

      if (observation.hintsRemaining > 0) {
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

      const playSlot = this.getMyPlayableSlot(observation);
      if (playSlot !== null) {
        const playAction = legalActions.find(
          (a) => a.type === 'play' && a.cardIndex === playSlot
        );
        if (playAction) return { ...playAction };
      }

      const fallbackDiscard = this.getMyLeftmostUnprotectedDiscardIndex(observation) ??
        (this.getMyProtectedCount(observation) >= observation.ownHandSize && observation.ownHandSize > 0 ? observation.ownHandSize - 1 : null);
      if (
        fallbackDiscard !== null &&
        observation.hintsRemaining < 8
      ) {
        const discardAction = legalActions.find(
          (a) => a.type === 'discard' && a.cardIndex === fallbackDiscard
        );
        if (discardAction) return { ...discardAction };
      }
    }

    const fallbackDiscard = this.getMyLeftmostUnprotectedDiscardIndex(observation);
    if (
      fallbackDiscard !== null &&
      observation.ownHandSize > 0 &&
      observation.hintsRemaining < 8
    ) {
      const discardAction = legalActions.find(
        (a) => a.type === 'discard' && a.cardIndex === fallbackDiscard
      );
      if (discardAction) return { ...discardAction };
    }

    if (
      fallbackDiscard === null &&
      this.getMyPlayableSlot(observation) === null &&
      observation.hintsRemaining > 0
    ) {
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

    if (
      observation.hintsRemaining >= 8 &&
      observation.hintsRemaining > 0
    ) {
      const partnerSeat = 1 - getSelfSeat(observation);
      const redHint = legalActions.find(
        (a) =>
          a.type === 'hint' &&
          a.targetPlayer === partnerSeat &&
          a.hintType === 'color' &&
          a.hintValue === Color.Red
      );
      if (redHint) return { ...redHint };
    }

    const safeLegalActions = this.filterOutUnplayableNumberHints(
      observation,
      legalActions
    );
    const actions = safeLegalActions.length > 0 ? safeLegalActions : legalActions;
    const idx = Math.floor(rng() * actions.length);
    return { ...actions[idx] };
  }

  /** Exclude number hints that would point to an unplayable card. */
  private filterOutUnplayableNumberHints(
    observation: Observation,
    actions: Action[]
  ): Action[] {
    const partnerSeat = 1 - getSelfSeat(observation);
    const { visibleCards, playedStacks } = observation;
    return actions.filter((a) => {
      if (
        a.type !== 'hint' ||
        a.targetPlayer !== partnerSeat ||
        a.hintType !== 'number'
      )
        return true;
      const position = (a.hintValue as number) - 1;
      if (position < 0 || position >= visibleCards.length) return false;
      const card = visibleCards[position];
      if (card.color === undefined || card.value === undefined) return false;
      const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
      return card.value === nextNeeded;
    });
  }

  private getPartnerLeftmostUnprotectedIndex(observation: Observation): number {
    const selfSeat = getSelfSeat(observation);
    const partnerSeat = 1 - selfSeat;
    const { visibleCards, actionHistory } = observation;

    let maxProtectedCount = 0;
    for (const ev of actionHistory) {
      if (
        ev.type === 'hint' &&
        ev.playerIndex === selfSeat &&
        ev.targetPlayer === partnerSeat &&
        ev.hintType === 'color'
      ) {
        const protectedCount = (ev.hintValue as number) + 1;
        if (protectedCount > maxProtectedCount) maxProtectedCount = protectedCount;
      }
    }

    return Math.min(maxProtectedCount, visibleCards.length);
  }

  private partnerCanSafelyDiscardOrPlay(observation: Observation): boolean {
    if (this.partnerHasPendingPlayableNumberHint(observation)) return true;

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

    const idx = this.getPartnerLeftmostUnprotectedIndex(observation);
    if (idx >= visibleCards.length) return true;

    const card = visibleCards[idx];
    if (card.color === undefined || card.value === undefined) return true;
    if (this.isCriticalCard(observation, card.color, card.value)) return false;
    return true;
  }

  /** True if discarding this card would lose it: not yet played and no other copies left. */
  private isCriticalCard(
    observation: Observation,
    color: Color,
    value: number
  ): boolean {
    if ((observation.playedStacks[color] ?? 0) >= value) return false;
    if (value === 5) return true; // only 1 copy per 5
    const total = DECK_COMPOSITION[value] ?? 0;
    const onStack = (observation.playedStacks[color] ?? 0) >= value ? 1 : 0;
    const inDiscard = observation.discardPile.filter(
      (c) => c.color === color && c.value === value
    ).length;
    const remaining = total - onStack - inDiscard; // copies still in game (deck + hands)
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

  /** How many of our leftmost slots are protected by color hints partner gave to us. */
  private getMyProtectedCount(observation: Observation): number {
    const selfSeat = getSelfSeat(observation);
    const partnerSeat = 1 - selfSeat;
    const { actionHistory } = observation;
    let maxProtectedCount = 0;
    for (const ev of actionHistory) {
      if (
        ev.type === 'hint' &&
        ev.playerIndex === partnerSeat &&
        ev.targetPlayer === selfSeat &&
        ev.hintType === 'color'
      ) {
        const protectedCount = (ev.hintValue as number) + 1;
        if (protectedCount > maxProtectedCount) maxProtectedCount = protectedCount;
      }
    }
    return maxProtectedCount;
  }

  private getMyLeftmostUnprotectedDiscardIndex(observation: Observation): number | null {
    const startSlot = this.getMyProtectedCount(observation);
    for (let slot = startSlot; slot < observation.ownHandSize && slot < 5; slot++) {
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
    return null;
  }

  /** Partner has a number hint for a playable card they haven't used yet → they will play next turn, no need to protect. */
  private partnerHasPendingPlayableNumberHint(observation: Observation): boolean {
    const partnerSeat = 1 - getSelfSeat(observation);
    const selfSeat = getSelfSeat(observation);
    const { actionHistory, visibleCards, playedStacks } = observation;
    for (let i = actionHistory.length - 1; i >= 0; i--) {
      const ev = actionHistory[i];
      if (ev.type === 'play' || ev.type === 'discard') {
        if (ev.playerIndex === partnerSeat) return false;
      }
      if (
        ev.type === 'hint' &&
        ev.playerIndex === selfSeat &&
        ev.targetPlayer === partnerSeat &&
        ev.hintType === 'number'
      ) {
        const position = (ev.hintValue as number) - 1;
        if (position >= 0 && position < visibleCards.length) {
          const card = visibleCards[position];
          if (card.color !== undefined && card.value !== undefined) {
            const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
            if (card.value === nextNeeded) return true;
          }
        }
        return false;
      }
    }
    return false;
  }

  /** Partner knows to play position X if we gave a number hint pointing to X, or they have full deduction. */
  private partnerKnowsPlayableAtPosition(observation: Observation, pos: number): boolean {
    if (this.partnerHasPendingNumberHintForPosition(observation, pos)) return true;
    const card = observation.visibleCards[pos];
    if (card?.color === undefined || card?.value === undefined) return false;
    const known = getKnownToHolder(observation, card.cardId);
    return (
      known?.color === card.color &&
      known?.value === card.value
    );
  }

  private partnerHasPendingNumberHintForPosition(
    observation: Observation,
    position: number
  ): boolean {
    const partnerSeat = 1 - getSelfSeat(observation);
    const selfSeat = getSelfSeat(observation);
    const { actionHistory } = observation;
    for (let i = actionHistory.length - 1; i >= 0; i--) {
      const ev = actionHistory[i];
      if (ev.type === 'play' || ev.type === 'discard') {
        if (ev.playerIndex === partnerSeat) return false;
      }
      if (
        ev.type === 'hint' &&
        ev.playerIndex === selfSeat &&
        ev.targetPlayer === partnerSeat &&
        ev.hintType === 'number'
      ) {
        return (ev.hintValue as number) === position + 1;
      }
    }
    return false;
  }

  private getPartnerPlayablePositionPartnerDoesNotKnow(
    observation: Observation
  ): number | null {
    const { visibleCards, playedStacks } = observation;
    let firstNonFive: number | null = null;
    for (let pos = 0; pos < visibleCards.length && pos < 5; pos++) {
      const card = visibleCards[pos];
      if (card.color === undefined || card.value === undefined) continue;
      const nextNeeded = (playedStacks[card.color] ?? 0) + 1;
      if (card.value !== nextNeeded) continue;

      if (!this.partnerKnowsPlayableAtPosition(observation, pos)) {
        if (card.value === 5) return pos;
        if (firstNonFive === null) firstNonFive = pos;
      }
    }
    return firstNonFive;
  }

  /** Protect the minimum cards so partner's discard target is safe. Only protect critical cards. */
  private getProtectionColorHintForPartner(observation: Observation): Color | null {
    const idx = this.getPartnerLeftmostUnprotectedIndex(observation);
    const { visibleCards } = observation;

    if (idx >= visibleCards.length) return null;

    const cardAtIdx = visibleCards[idx];
    if (
      cardAtIdx.color === undefined ||
      cardAtIdx.value === undefined ||
      !this.isCriticalCard(observation, cardAtIdx.color, cardAtIdx.value)
    ) {
      return null;
    }

    for (let k = idx + 1; k <= visibleCards.length && k <= 5; k++) {
      if (k >= visibleCards.length) return COLORS[Math.min(visibleCards.length, 5) - 1];
      const card = visibleCards[k];
      if (card.color === undefined || card.value === undefined) continue;
      if (!this.isCriticalCard(observation, card.color, card.value)) {
        return COLORS[k - 1];
      }
    }
    return COLORS[Math.min(visibleCards.length, 5) - 1];
  }
}
