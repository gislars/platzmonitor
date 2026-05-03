import type { HistoryPoint } from "./types";

/** Sortiert Punkte aufsteigend nach Zeitstempel `t`. */
export function sortHistoryPointsAsc(points: HistoryPoint[]): HistoryPoint[] {
  return [...points].sort((a, b) => a.t - b.t);
}
