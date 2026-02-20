import type { Color } from '../engine/types';
import type { GameEvent } from '../engine/events';
import type { Observation } from '../engine/observation';
import { getSelfSeat } from '../engine/observation';

/** Hint knowledge for a card: what the holder has been told (and option removal). */
export interface HintKnowledge {
  color?: Color;
  value?: number;
  excludedColors?: Color[];
  excludedValues?: number[];
}

function isHintEvent(e: GameEvent): e is GameEvent & { type: 'hint'; matchedCardIds?: number[] } {
  return e.type === 'hint';
}

/**
 * Derives per-slot hint knowledge for the observer's hand from action history.
 * Use this instead of reading observation.ownHintKnowledge (no longer on observation).
 */
export function getOwnHintKnowledge(
  observation: Observation,
  slotIndex: number
): HintKnowledge | undefined {
  if (slotIndex < 0 || slotIndex >= observation.ownCardIds.length) return undefined;
  const cardId = observation.ownCardIds[slotIndex];
  const selfSeat = getSelfSeat(observation);
  return getKnowledgeForCard(observation.actionHistory, cardId, selfSeat);
}

/**
 * Derives what the holder of the given card has been told about it (from hints and option removal).
 * Use this instead of reading visibleCard.knownToHolder (no longer on VisibleCard).
 */
export function getKnownToHolder(
  observation: Observation,
  cardId: number
): HintKnowledge | undefined {
  if (!observation.visibleCards.some((c) => c.cardId === cardId)) return undefined;
  const partnerSeat = 1 - getSelfSeat(observation);
  return getKnowledgeForCard(observation.actionHistory, cardId, partnerSeat);
}

function getKnowledgeForCard(
  actionHistory: GameEvent[],
  cardId: number,
  targetSeat: number
): HintKnowledge | undefined {
  const knowledge: HintKnowledge = {};
  for (const event of actionHistory) {
    if (!isHintEvent(event) || event.targetPlayer !== targetSeat) continue;
    const matchedIds = event.matchedCardIds ?? [];
    const matched = matchedIds.includes(cardId);
    if (event.hintType === 'color') {
      const color = event.hintValue as Color;
      if (matched) {
        knowledge.color = color;
      } else {
        const excluded = knowledge.excludedColors ?? [];
        if (!excluded.includes(color)) {
          knowledge.excludedColors = [...excluded, color];
        }
      }
    } else {
      const value = event.hintValue as number;
      if (matched) {
        knowledge.value = value;
      } else {
        const excluded = knowledge.excludedValues ?? [];
        if (!excluded.includes(value)) {
          knowledge.excludedValues = [...excluded, value];
        }
      }
    }
  }
  return Object.keys(knowledge).length > 0 ? knowledge : undefined;
}

