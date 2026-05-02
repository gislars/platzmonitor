import type { Entry } from "./types";

/** gebuchte Plätze: bei finite über total−free, bei unlimited über transactionBooked (Timeline), sonst null. */
export function entryBooked(entry: Entry): number | null {
  if (entry.availability.kind === "unlimited") {
    const tb = entry.transactionBooked;
    return tb != null && Number.isFinite(tb) ? Math.max(0, Math.floor(tb)) : null;
  }
  const total = entry.availability.total;
  if (total == null) {
    return null;
  }
  return Math.max(0, total - entry.availability.free);
}

export function entryFreePlaces(entry: Entry): number | null {
  if (entry.availability.kind === "unlimited") {
    return null;
  }
  return entry.availability.free;
}

/** Roher API-Wert in eine nicht-negative Ganzzahl (sonst 0). Ignoriert Booleans und NaN. */
function normalizedWaitingListCount(raw: number | string | null | undefined): number {
  if (raw == null) {
    return 0;
  }
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    n = Number(raw.trim());
  } else {
    return 0;
  }
  if (!Number.isFinite(n)) {
    return 0;
  }
  const k = Math.floor(n);
  return k > 0 ? k : 0;
}

/** Wartelistenanzahl, falls aktiviert und bekannt, sonst 0 */
export function entryWaitingList(entry: Entry): number {
  if (!entry.waitingListEnabled) {
    return 0;
  }
  return normalizedWaitingListCount(entry.waitingListCount ?? null);
}
