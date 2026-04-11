import type { Entry } from "./types";

/**
 * Ob ein Eintrag nach bekanntem Startzeitpunkt (`sortAt`) noch nicht begonnen hat.
 * Ohne gültiges `sortAt` (z. B. „Termin offen“): true, damit nichts Verborgenes wegfällt.
 */
export function isEntryStartInFutureOrNow(entry: Entry): boolean {
  const raw = entry.sortAt;
  if (raw == null || raw === "") {
    return true;
  }
  const t = Date.parse(raw);
  if (Number.isNaN(t)) {
    return true;
  }
  return t >= Date.now();
}
