/** ISO-Zeitstempel als kurzes Datum und Uhrzeit (de-DE), z. B. für «Stand». */
export function formatFetchedDeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
