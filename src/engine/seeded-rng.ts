/**
 * Creates a deterministic seeded RNG using the Mulberry32 algorithm.
 * Returns a function that yields values in [0, 1). Same seed produces identical sequence.
 * Uses Math.imul and bit ops only - no Math.random.
 */
export function createSeededRNG(seed: number): () => number {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
