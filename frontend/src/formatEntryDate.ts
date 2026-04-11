/** Wochentag, Datum und optional Uhrzeit für Kacheln (`de-DE`). */
export function formatEntrySortAt(iso: string | null | undefined): string {
  if (iso == null || iso === "") {
    return "Termin offen";
  }
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    return "Termin offen";
  }
  const d = new Date(t);
  return d.toLocaleString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
