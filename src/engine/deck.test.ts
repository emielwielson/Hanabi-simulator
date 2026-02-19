import { createDeck, shuffleDeck } from './deck';

describe('createDeck', () => {
  it('creates 50 cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(50);
  });

  it('each card has unique ID', () => {
    const deck = createDeck();
    const ids = deck.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(50);
  });

  it('deck has correct composition per color', () => {
    const deck = createDeck();
    const byColor = new Map<number, number[]>();
    for (const c of deck) {
      if (!byColor.has(c.color)) byColor.set(c.color, []);
      byColor.get(c.color)!.push(c.value);
    }
    expect(byColor.size).toBe(5);
    for (const values of byColor.values()) {
      expect(values).toHaveLength(10);
      expect(values.filter((v) => v === 1)).toHaveLength(3);
      expect(values.filter((v) => v === 2)).toHaveLength(2);
      expect(values.filter((v) => v === 3)).toHaveLength(2);
      expect(values.filter((v) => v === 4)).toHaveLength(2);
      expect(values.filter((v) => v === 5)).toHaveLength(1);
    }
  });
});

describe('shuffleDeck', () => {
  it('is deterministic for same seed', () => {
    const deck = createDeck();
    const sh1 = shuffleDeck(deck, 42);
    const sh2 = shuffleDeck(deck, 42);
    expect(sh1.map((c) => c.id)).toEqual(sh2.map((c) => c.id));
  });

  it('different seeds produce different order', () => {
    const deck = createDeck();
    const sh1 = shuffleDeck(deck, 1);
    const sh2 = shuffleDeck(deck, 2);
    expect(sh1.map((c) => c.id)).not.toEqual(sh2.map((c) => c.id));
  });

  it('does not mutate input', () => {
    const deck = createDeck();
    const originalIds = deck.map((c) => c.id);
    shuffleDeck(deck, 42);
    expect(deck.map((c) => c.id)).toEqual(originalIds);
  });
});
