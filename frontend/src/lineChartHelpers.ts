/** Mindestens zwei Punkte und Y-Spanne unter Schwellwert (waagerechte Linie). */
export function areLinePointsYsFlat(points: readonly { x: number; y: number }[]): boolean {
  if (points.length < 2) {
    return false;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    lo = Math.min(lo, p.y);
    hi = Math.max(hi, p.y);
  }
  return !(hi > lo && hi - lo > 1e-6);
}
