import type { Observation } from '../../engine/observation';
import type { GameEvent } from '../../engine/events';
import { Color, COLORS } from '../../engine/types';

/** Fixed size of the observation vector. Must match model input shape. */
export const ENCODER_OUTPUT_SIZE = 491;

const MAX_PLAYERS = 5;
const MAX_HAND_SIZE = 5;
const MAX_DISCARD_CAP = 20;
const ACTION_HISTORY_LAST_K = 10;
const COLORS_COUNT = 5;
const VALUES_COUNT = 5;

/** One-hot encode value in [0, maxExclusive) into array of length maxExclusive. */
function oneHot(value: number, maxExclusive: number): number[] {
  const out = new Array(maxExclusive).fill(0);
  if (value >= 0 && value < maxExclusive) out[value] = 1;
  return out;
}

/** Encode a card (color 0-4, value 1-5) as 5 + 5 = 10 floats. */
function encodeCard(color: number | undefined, value: number | undefined): number[] {
  const c = color !== undefined && color >= 0 && color < COLORS_COUNT ? color : -1;
  const v = value !== undefined && value >= 1 && value <= 5 ? value - 1 : -1;
  return [...oneHot(c >= 0 ? c : 0, COLORS_COUNT), ...oneHot(v >= 0 ? v : 0, VALUES_COUNT)];
}

/**
 * Encode Observation into a fixed-size float vector of length ENCODER_OUTPUT_SIZE.
 * Layout: scalars (11) | visibleHands (4*5*10=200) | discardPile cap (20*10=200) | actionHistory last K (10*8=80).
 */
export function encodeObservation(obs: Observation): number[] {
  const out: number[] = [];

  // Scalars (11): currentPlayer, selfSeat, ownHandSize, hintsRemaining, livesRemaining, deckCount (capped), playedStacks[0..4]
  out.push(obs.currentPlayer / Math.max(1, MAX_PLAYERS - 1));
  out.push(obs.selfSeat / Math.max(1, MAX_PLAYERS - 1));
  out.push(obs.ownHandSize / MAX_HAND_SIZE);
  out.push(obs.hintsRemaining / 8);
  out.push(obs.livesRemaining / 3);
  out.push(Math.min(1, (obs.deckCount ?? 0) / 50));
  for (const col of COLORS) {
    out.push((obs.playedStacks[col] ?? 0) / 5);
  }

  // visibleHands: up to 4 other players (indices 0..4 excluding self), each up to 5 cards, each 10 floats
  for (let p = 0; p < MAX_PLAYERS; p++) {
    if (p === obs.selfSeat) continue;
    const hand = obs.visibleHands[p] ?? [];
    for (let s = 0; s < MAX_HAND_SIZE; s++) {
      const card = hand[s];
      out.push(...encodeCard(card?.color, card?.value));
    }
    // Pad if hand has fewer than MAX_HAND_SIZE cards (we already iterate 5 slots, encodeCard handles missing)
  }
  // If fewer than 4 other players, we still need 4*5*10 = 200 floats. So we iterate all 5 player indices and skip self -> 4 players * 5 * 10 = 200. Good.

  // discardPile: cap at MAX_DISCARD_CAP, each card 10 floats
  const discard = obs.discardPile ?? [];
  for (let i = 0; i < MAX_DISCARD_CAP; i++) {
    const card = discard[i];
    out.push(...encodeCard(card?.color, card?.value));
  }

  // actionHistory: last ACTION_HISTORY_LAST_K events, each ~8 floats: type(3), playerIndex, extra
  const history = obs.actionHistory ?? [];
  const start = Math.max(0, history.length - ACTION_HISTORY_LAST_K);
  for (let i = start; i < history.length; i++) {
    const ev = history[i] as GameEvent;
    if (ev.type === 'play') {
      out.push(1, 0, 0);
      out.push(ev.playerIndex / Math.max(1, MAX_PLAYERS - 1));
      out.push((ev.cardIndex ?? 0) / MAX_HAND_SIZE);
      out.push(ev.success ? 1 : 0);
      out.push(0, 0, 0);
    } else if (ev.type === 'discard') {
      out.push(0, 1, 0);
      out.push(ev.playerIndex / Math.max(1, MAX_PLAYERS - 1));
      out.push((ev.cardIndex ?? 0) / MAX_HAND_SIZE);
      out.push(0, 0, 0, 0, 0);
    } else if (ev.type === 'hint') {
      out.push(0, 0, 1);
      out.push(ev.playerIndex / Math.max(1, MAX_PLAYERS - 1));
      out.push((ev.targetPlayer ?? 0) / Math.max(1, MAX_PLAYERS - 1));
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
  // Pad to exactly ACTION_HISTORY_LAST_K * 8
  const filled = Math.min(ACTION_HISTORY_LAST_K, history.length - start);
  for (let i = filled; i < ACTION_HISTORY_LAST_K; i++) {
    for (let j = 0; j < 8; j++) out.push(0);
  }

  // Ensure exact size (pad or trim)
  while (out.length < ENCODER_OUTPUT_SIZE) out.push(0);
  return out.slice(0, ENCODER_OUTPUT_SIZE);
}
