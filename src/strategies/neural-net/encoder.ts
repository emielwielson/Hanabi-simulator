import type { Observation } from '../../engine/observation';
import type { GameEvent } from '../../engine/events';
import { COLORS } from '../../engine/types';
import {
  getOwnHintKnowledge,
  getKnownToHolder,
  type HintKnowledge,
} from '../observation-knowledge';

/** Fixed size of the observation vector. Must match model input shape. 2-player: 10 + 100 + 50 + 100 + 200 + 80 = 540. */
export const ENCODER_OUTPUT_SIZE = 540;

const MAX_HAND_SIZE = 5;
const MAX_DISCARD_CAP = 20;
const ACTION_HISTORY_LAST_K = 10;
const COLORS_COUNT = 5;
const VALUES_COUNT = 5;
const PLAYER_COUNT = 2;
const HINT_KNOWLEDGE_SIZE = 20;

/** One-hot encode value in [0, maxExclusive) into array of length maxExclusive. */
function oneHot(value: number, maxExclusive: number): number[] {
  const out = new Array(maxExclusive).fill(0);
  if (value >= 0 && value < maxExclusive) out[value] = 1;
  return out;
}

/** Multi-hot: set positions for each value in values (0-based indices) to 1. */
function multiHot(indices: number[], size: number): number[] {
  const out = new Array(size).fill(0);
  for (const i of indices) {
    if (i >= 0 && i < size) out[i] = 1;
  }
  return out;
}

/** Encode HintKnowledge as 20 floats: known color (5) + known value (5) + excluded colors (5) + excluded values (5). */
function encodeHintKnowledge(k: HintKnowledge | undefined): number[] {
  if (!k) return new Array(HINT_KNOWLEDGE_SIZE).fill(0);
  const knownColor =
    k.color !== undefined && k.color >= 0 && k.color < COLORS_COUNT
      ? oneHot(k.color, COLORS_COUNT)
      : new Array(COLORS_COUNT).fill(0);
  const knownValue =
    k.value !== undefined && k.value >= 1 && k.value <= 5
      ? oneHot(k.value - 1, VALUES_COUNT)
      : new Array(VALUES_COUNT).fill(0);
  const excludedC = multiHot(
    (k.excludedColors ?? []).map((c) => (typeof c === 'number' ? c : (c as number))),
    COLORS_COUNT
  );
  const excludedV = multiHot(
    (k.excludedValues ?? []).map((v) => v - 1),
    VALUES_COUNT
  );
  return [...knownColor, ...knownValue, ...excludedC, ...excludedV];
}

/** Encode a card (color 0-4, value 1-5) as 5 + 5 = 10 floats. */
function encodeCard(color: number | undefined, value: number | undefined): number[] {
  const c = color !== undefined && color >= 0 && color < COLORS_COUNT ? color : -1;
  const v = value !== undefined && value >= 1 && value <= 5 ? value - 1 : -1;
  return [...oneHot(c >= 0 ? c : 0, COLORS_COUNT), ...oneHot(v >= 0 ? v : 0, VALUES_COUNT)];
}

/**
 * Encode Observation into a fixed-size float vector of length ENCODER_OUTPUT_SIZE.
 * Layout: scalars (10) | own hint knowledge (5*20=100) | visibleCards partner hand (5*10=50) | partner hint knowledge (5*20=100) | discardPile cap (20*10=200) | actionHistory last K (10*8=80).
 * 2-player only: visibleCards is the partner's hand; observerSeat identifies self.
 */
export function encodeObservation(obs: Observation): number[] {
  const out: number[] = [];

  // Scalars (10): observerSeat, ownHandSize, hintsRemaining, livesRemaining, deckCount (capped), playedStacks[0..4]
  out.push(obs.observerSeat / Math.max(1, PLAYER_COUNT - 1));
  out.push(obs.ownHandSize / MAX_HAND_SIZE);
  out.push(obs.hintsRemaining / 8);
  out.push(obs.livesRemaining / 3);
  out.push(Math.min(1, (obs.deckCount ?? 0) / 50));
  for (const col of COLORS) {
    out.push((obs.playedStacks[col] ?? 0) / 5);
  }

  // Own hint knowledge: 5 slots × 20 floats
  for (let slot = 0; slot < MAX_HAND_SIZE; slot++) {
    out.push(...encodeHintKnowledge(getOwnHintKnowledge(obs, slot)));
  }

  // visibleCards: partner's hand only, up to 5 cards, each 10 floats
  const visibleCards = obs.visibleCards ?? [];
  for (let s = 0; s < MAX_HAND_SIZE; s++) {
    const card = visibleCards[s];
    out.push(...encodeCard(card?.color, card?.value));
  }

  // Partner hint knowledge: 5 cards × 20 floats
  for (let s = 0; s < MAX_HAND_SIZE; s++) {
    const card = visibleCards[s];
    const cardId = card?.cardId;
    const knowledge =
      cardId !== undefined ? getKnownToHolder(obs, cardId) : undefined;
    out.push(...encodeHintKnowledge(knowledge));
  }

  // discardPile: cap at MAX_DISCARD_CAP, each card 10 floats
  const discard = obs.discardPile ?? [];
  for (let i = 0; i < MAX_DISCARD_CAP; i++) {
    const card = discard[i];
    out.push(...encodeCard(card?.color, card?.value));
  }

  // actionHistory: last ACTION_HISTORY_LAST_K events, each 8 floats
  const history = obs.actionHistory ?? [];
  const start = Math.max(0, history.length - ACTION_HISTORY_LAST_K);
  for (let i = start; i < history.length; i++) {
    const ev = history[i] as GameEvent;
    if (ev.type === 'play') {
      out.push(1, 0, 0);
      out.push((ev.playerIndex ?? 0) / Math.max(1, PLAYER_COUNT - 1));
      out.push((ev.cardIndex ?? 0) / MAX_HAND_SIZE);
      out.push(ev.success ? 1 : 0);
      out.push(0, 0, 0);
    } else if (ev.type === 'discard') {
      out.push(0, 1, 0);
      out.push((ev.playerIndex ?? 0) / Math.max(1, PLAYER_COUNT - 1));
      out.push((ev.cardIndex ?? 0) / MAX_HAND_SIZE);
      out.push(0, 0, 0, 0, 0);
    } else if (ev.type === 'hint') {
      out.push(0, 0, 1);
      out.push((ev.playerIndex ?? 0) / Math.max(1, PLAYER_COUNT - 1));
      out.push((ev.targetPlayer ?? 0) / Math.max(1, PLAYER_COUNT - 1));
      out.push(ev.hintType === 'color' ? 0 : 1);
      const hv =
        ev.hintValue !== undefined && typeof ev.hintValue === 'number'
          ? ev.hintType === 'color'
            ? (ev.hintValue as number) / 4
            : ((ev.hintValue as number) - 1) / 4
          : 0;
      out.push(hv);
      out.push(0, 0, 0);
    } else {
      out.push(0, 0, 0, 0, 0, 0, 0, 0);
    }
  }
  const filled = Math.min(ACTION_HISTORY_LAST_K, history.length - start);
  for (let i = filled; i < ACTION_HISTORY_LAST_K; i++) {
    for (let j = 0; j < 8; j++) out.push(0);
  }

  while (out.length < ENCODER_OUTPUT_SIZE) out.push(0);
  return out.slice(0, ENCODER_OUTPUT_SIZE);
}
