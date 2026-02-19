import { createSeededRNG } from './seeded-rng';
import { type Card, Color, COLORS, DECK_COMPOSITION } from './types';

/**
 * Creates a standard Hanabi deck: 5 colors × (3×1, 2×2, 2×3, 2×4, 1×5) = 50 cards.
 * Each card has a stable unique ID (0-49).
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    for (let value = 1; value <= 5; value++) {
      const count = DECK_COMPOSITION[value];
      for (let i = 0; i < count; i++) {
        deck.push({ id: id++, color, value });
      }
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using seeded RNG. Deterministic for same seed (FR-2).
 * Returns a new array; does not mutate input.
 */
export function shuffleDeck(deck: Card[], seed: number): Card[] {
  const result = [...deck];
  const rng = createSeededRNG(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
