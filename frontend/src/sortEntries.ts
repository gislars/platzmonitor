import type { Entry } from "./types";

function sortKey(entry: Entry): number {
  if (entry.sortAt == null || entry.sortAt === "") {
    return Number.POSITIVE_INFINITY;
  }
  const t = Date.parse(entry.sortAt);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Sortiert aufsteigend nach `sortAt`; ungültige oder fehlende Werte sortieren ans Ende (stabil über `id`). */
export function sortEntriesByDateTimeAsc(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka !== kb) {
      return ka - kb;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Sortiert aufsteigend nach `label` (Locale de); bei Gleichheit stabil über `id`. */
export function sortEntriesByLabelAsc(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const cmp = a.label.localeCompare(b.label, "de", { sensitivity: "base" });
    if (cmp !== 0) {
      return cmp;
    }
    return a.id.localeCompare(b.id);
  });
}
