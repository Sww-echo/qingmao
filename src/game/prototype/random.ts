/** Portable Mulberry32 step. Persist rng, and divide the uint32 numerator by 2^32. */
export function nextPrototypeRandom(rng: number): { rng: number; numerator: number; value: number } {
  if (!Number.isInteger(rng) || rng < 0 || rng > 0xffffffff) throw new RangeError('rng must be a uint32 integer');
  const nextRng = (rng + 0x6d2b79f5) >>> 0;
  let value = nextRng;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  const numerator = (value ^ value >>> 14) >>> 0;
  return { rng: nextRng, numerator, value: numerator / 4294967296 };
}
