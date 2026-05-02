import { formatFetchedDeShort } from "../formatFetchedDeShort";

/** Dezent hinter Überschrift: „Stand: …“ bei gültiger ISO-Zeit. */
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
