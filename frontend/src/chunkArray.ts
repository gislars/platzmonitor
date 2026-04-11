/** Zerlegt `items` in Blöcke der Länge `size` (mindestens 1). */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const s = Math.max(1, Math.floor(size));
  if (items.length === 0) {
    return [];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += s) {
    out.push(items.slice(i, i + s));
  }
  return out;
}
