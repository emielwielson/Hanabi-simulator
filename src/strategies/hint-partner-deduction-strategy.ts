import { createSeededRNG } from '../engine/seeded-rng';
import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';
import type { GameEvent } from '../engine/events';
import type { Color } from '../engine/types';

/**
 * Extends HintPartner with deduction: when we did not just receive a partner hint,
 * and partner has no playable card, look at all hints we've received and play any
 * card we know 100% is playable (we know both color and value, and it's the next needed).
 */
export class HintPartnerDeductionStrategy implements HanabiStrategy {
  private config: GameConfig | null = null;
  private seatIndex = 0;
  private rng: (() => number) | null = null;
  private rngSeed: number;
  /** Per-position knowledge: { color?, value? } for our hand. Updated from hints and plays. */
  private ownKnowledge: Array<{ color?: Color; value?: number }> = [];

  constructor(rngSeed = 42) {
    this.rngSeed = rngSeed;
  }

  initialize(config: GameConfig, seatIndex: number): void {
    this.config = config;
    this.seatIndex = seatIndex;
    this.rng = createSeededRNG(this.rngSeed + seatIndex);
    const handSize = config.playerCount <= 3 ? 5 : 4;
    this.ownKnowledge = Array.from({ length: handSize }, () => ({}));
  }

  onGameStart(_observation: Observation): void {
    this.ownKnowledge = this.ownKnowledge.map(() => ({}));
  }

  getAction(observation: Observation): Action {
    if (!this.rng) {
      throw new Error('Strategy not initialized');
    }

    const legalActions = observation.legalActions ?? [];
    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: 0 };
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

    // 3. Deduction: we did not just receive a hint, partner has no playable.
    //    Look at hints we've received - play any card we know 100% is playable.
    const playFromDeduction = this.getPlayFromDeduction(observation);
    if (playFromDeduction !== null) {
      const playAction = legalActions.find(
        (a) => a.type === 'play' && a.cardIndex === playFromDeduction
      );
      if (playAction) return { ...playAction };
    }

    // 4. Random legal action
    const idx = Math.floor(this.rng() * legalActions.length);
    return { ...legalActions[idx] };
  }

  /**
   * Returns the card index to play if we received a hint we haven't acted on yet.
   * Position-encoding: hint value N means play position N-1 (0-based).
   */
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

  /**
   * Position-encoding: hint value N means "position N-1 is playable".
   */
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

  /**
   * When we didn't just receive a hint and partner has no playable card,
   * find a card we know 100% is playable (both color and value known, matches next needed).
   */
  private getPlayFromDeduction(observation: Observation): number | null {
    // Only apply when we didn't just receive a hint (else HintPartner handles it)
    if (this.didJustReceiveHint(observation)) return null;
    if (this.partnerHasPlayableCard(observation)) return null;

    const { playedStacks } = observation;
    const handSize = observation.ownHandSize;

    for (let i = 0; i < handSize && i < this.ownKnowledge.length; i++) {
      const known = this.ownKnowledge[i];
      if (known.color === undefined || known.value === undefined) continue;
      const nextNeeded = (playedStacks[known.color] ?? 0) + 1;
      if (known.value === nextNeeded) {
        return i;
      }
    }
    return null;
  }

  private didJustReceiveHint(observation: Observation): boolean {
    if (observation.actionHistory.length === 0) return false;
    const last = observation.actionHistory[observation.actionHistory.length - 1];
    return last.type === 'hint' && last.targetPlayer === observation.selfSeat;
  }

  private partnerHasPlayableCard(observation: Observation): boolean {
    return this.getHintForPlayableCard(observation) !== null;
  }

  onActionResolved(event: GameEvent): void {
    if (event.playerIndex !== this.seatIndex) {
      // Other player acted; our hand unchanged
      return;
    }

    if (event.type === 'play' || event.type === 'discard') {
      // We played or discarded from cardIndex; shift knowledge
      const cardIndex = event.cardIndex;
      const size = this.ownKnowledge.length;
      for (let i = cardIndex; i < size - 1; i++) {
        this.ownKnowledge[i] = { ...this.ownKnowledge[i + 1] };
      }
      this.ownKnowledge[size - 1] = {};
    } else if (event.type === 'hint' && event.targetPlayer === this.seatIndex) {
      // We received a hint; add knowledge for matched positions
      for (const idx of event.matchedCardIndices) {
        if (idx < this.ownKnowledge.length) {
          const k = this.ownKnowledge[idx];
          if (event.hintType === 'color') {
            this.ownKnowledge[idx] = { ...k, color: event.hintValue as Color };
          } else {
            this.ownKnowledge[idx] = { ...k, value: event.hintValue as number };
          }
        }
      }
    }
  }

  onGameEnd(_result: import('../engine/events').FinalState): void {
    // No-op
  }

  clone(): HanabiStrategy {
    return new HintPartnerDeductionStrategy(this.rngSeed);
  }
}
