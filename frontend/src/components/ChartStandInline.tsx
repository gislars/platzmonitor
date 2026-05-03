import { formatFetchedDeShort } from "../formatFetchedDeShort";

/** Zeigt «Stand: …» mit kurz formatierter ISO-Zeit neben einer Überschrift. */
export function ChartStandInline({ iso }: { iso?: string | null }) {
  const raw = iso?.trim();
  if (raw === undefined || raw === "") {
    return null;
  }
  const s = formatFetchedDeShort(raw);
  return (
    <span className="dashboard__chart-stand" aria-label={`Stand ${s}`}>
      Stand: {s}
    </span>
  );
}
