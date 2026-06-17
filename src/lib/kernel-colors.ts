/** Stable per-kernel yellow fill weighted toward #FFDB00 between #FFAC00 and #FFEC00. */

const LOW = { r: 0xff, g: 0xac, b: 0x00 };
const HIGH = { r: 0xff, g: 0xec, b: 0x00 };
const TARGET = { r: 0xff, g: 0xdb, b: 0x00 };

function seededRandom(seed: number, row: number, col: number): number {
  let h = seed ^ (row * 73856093) ^ (col * 19349663);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Bias t toward the midpoint color (#FFDB00). */
function weightedT(raw: number): number {
  const targetT =
    (TARGET.r - LOW.r) / (HIGH.r - LOW.r + HIGH.g - LOW.g + HIGH.b - LOW.b);
  const spread = 0.35;
  const centered = raw * spread * 2 - spread + targetT;
  return Math.max(0, Math.min(1, centered));
}

export function kernelColor(row: number, col: number, seed: number): string {
  const raw = seededRandom(seed, row, col);
  const t = weightedT(raw);
  const r = lerp(LOW.r, HIGH.r, t);
  const g = lerp(LOW.g, HIGH.g, t);
  const b = lerp(LOW.b, HIGH.b, t);
  return toHex(r, g, b);
}

export function kernelId(campaignId: string, row: number, col: number): string {
  return `${campaignId}-r${row}c${col}`;
}
