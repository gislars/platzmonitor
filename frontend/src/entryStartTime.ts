import type { Entry } from "./types";

/** Liefert true, wenn `sortAt` fehlt, unlesbar ist oder nicht vor dem aktuellen Zeitpunkt liegt. */
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
