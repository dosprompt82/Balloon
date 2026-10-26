/** Deterministic, seedable PRNG (mulberry32). Every gameplay random roll goes through this. */
export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }
  /** Derive an independent child stream so subsystems don't perturb each other. */
  fork(salt: number): Rng {
    return new Rng(hashInts(Math.floor(this.next() * 2 ** 31), salt));
  }
}

export function hashInts(a: number, b: number): number {
  let h = (a ^ 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ b ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Smooth 1D value noise, deterministic for a given seed. */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = (hashInts(i, seed) / 4294967296) * 2 - 1;
  const b = (hashInts(i + 1, seed) / 4294967296) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
