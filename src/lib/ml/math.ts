export function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const ex = logits.map((z) => Math.exp(Math.min(40, Math.max(-40, z - m))));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / s);
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function poissonSample(lambda: number, rand: () => number): number {
  const L = Math.exp(-Math.max(0.05, lambda));
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rand();
  } while (p > L && k < 12);
  return k - 1;
}

export function poissonPmf(k: number, lambda: number): number {
  if (k < 0) return 0;
  const lam = Math.max(0.05, lambda);
  let log = -lam + k * Math.log(lam);
  for (let i = 2; i <= k; i++) log -= Math.log(i);
  return Math.exp(log);
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function hashSeed(a: string, b: string): number {
  const s = `${a}\0${b}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
