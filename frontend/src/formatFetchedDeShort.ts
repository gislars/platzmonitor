/** Kurzes de-DE Datum und Uhrzeit für UI-Zeilen wie „Stand: …“. */
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
