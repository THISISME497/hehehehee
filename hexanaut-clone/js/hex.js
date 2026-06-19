/** Axial hex grid utilities (flat-top orientation). */

export const HEX_SIZE = 18;

/** Six axial directions: E, SE, SW, W, NW, NE */
export const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/** Angle (radians) for each direction index — flat-top hex. */
export const DIR_ANGLES = DIRECTIONS.map((_, i) => (Math.PI / 3) * i);

export function key(q, r) {
  return `${q},${r}`;
}

export function parseKey(k) {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export function hexToPixel(q, r) {
  const x = HEX_SIZE * (3 / 2) * q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

export function pixelToHex(x, y) {
  const q = (2 / 3 * x) / HEX_SIZE;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / HEX_SIZE;
  return axialRound(q, r);
}

function axialRound(fq, fr) {
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(-fq - fr);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - (-fq - fr));
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

export function neighbor(q, r, dir) {
  const d = DIRECTIONS[dir];
  return { q: q + d.q, r: r + d.r };
}

export function dist(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

/** Generate hex cells within radius of center. */
export function generateMap(radius) {
  const cells = new Set();
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (dist(0, 0, q, r) <= radius) {
        cells.add(key(q, r));
      }
    }
  }
  return cells;
}

/** Small starter territory around a spawn point. */
export function starterTerritory(q, r, size = 2) {
  const cells = new Set();
  for (let dq = -size; dq <= size; dq++) {
    for (let dr = -size; dr <= size; dr++) {
      if (dist(q, r, q + dq, r + dr) <= size) {
        cells.add(key(q + dq, r + dr));
      }
    }
  }
  return cells;
}

/** Snap angle to nearest hex direction index. */
export function angleToDir(angle) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < DIR_ANGLES.length; i++) {
    let diff = Math.abs(normalizeAngle(angle - DIR_ANGLES[i]));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dirToAngle(dir) {
  return DIR_ANGLES[dir];
}
