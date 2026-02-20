import { createSeededRNG } from '../engine/seeded-rng';
import type { GameConfig } from '../config';
import type { Action } from '../engine/actions';
import type { HanabiStrategy, Observation } from './types';
import type { Color } from '../engine/types';
import { DECK_COMPOSITION } from '../engine/types';

/**
 * HintPartner_discard variant with safe discard: we discard from left to right (leftmost first).
 * We never discard the leftmost card when: we know it's a 5 (only one per color in the deck),
 * or we know both color and value and it's the only copy left; in those cases we discard the
 * card to the right of it (index 1) instead.
 */
export class HintPartnerDiscardLeftSafeStrategy implements HanabiStrategy {
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
    const leftmostIndex = 0;

    if (legalActions.length === 0) {
      if (observation.ownHandSize > 0 && observation.hintsRemaining < 8) {
        return { type: 'discard', cardIndex: leftmostIndex };
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

    // 3. Prefer discard leftmost (discard from left to right); if that card is known and the only copy left, or we know it's a 5 (only one per color), discard the one to the right of it instead
    if (observation.hintsRemaining < 8) {
      const knowledge = observation.ownHintKnowledge?.[leftmostIndex];
      const color = knowledge?.color;
      const value = knowledge?.value;
      let discardIndex = leftmostIndex;
      const isProtected =
        value === 5 ||
        (color !== undefined &&
          value !== undefined &&
          this.isOnlyCopyLeft(observation, color, value));
      if (isProtected) {
        const rightIndex = 1;
        if (rightIndex < observation.ownHandSize) {
          const discardRight = legalActions.find(
            (a) => a.type === 'discard' && a.cardIndex === rightIndex
          );
          if (discardRight) discardIndex = rightIndex;
        }
      }
      const discardAction = legalActions.find(
        (a) => a.type === 'discard' && a.cardIndex === discardIndex
      );
      if (discardAction) return { ...discardAction };
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

  /**
   * Returns true if (color, value) is the only copy left (excluding our hand).
   * Used to avoid discarding the last copy of a card we need.
   */
  private isOnlyCopyLeft(
    observation: Observation,
    color: Color,
    value: number
  ): boolean {
    const total = DECK_COMPOSITION[value] ?? 0;
    const onStack = (observation.playedStacks[color] ?? 0) >= value ? 1 : 0;
    const inDiscard = observation.discardPile.filter(
      (c) => c.color === color && c.value === value
    ).length;
    let inVisibleHands = 0;
    for (const seatStr of Object.keys(observation.visibleHands)) {
      const hand = observation.visibleHands[Number(seatStr)];
      if (!hand) continue;
      for (const card of hand) {
        if (card.color === color && card.value === value) inVisibleHands++;
      }
    }
    const remaining = total - onStack - inDiscard - inVisibleHands;
    return remaining === 1;
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
    return new HintPartnerDiscardLeftSafeStrategy(this.rngSeed);
  }
}
