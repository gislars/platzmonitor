import type { HistoryPoint } from "./types";

/** Sortiert Historienpunkte aufsteigend nach Bucket-Zeit `t`. */
export function sortHistoryPointsAsc(points: HistoryPoint[]): HistoryPoint[] {
  return [...points].sort((a, b) => a.t - b.t);
}
