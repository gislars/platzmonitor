/**
 * Farbenblindfreundliche Serienpalette (Okabe–Ito / Paul-Tol-inspirierte Abstufung),
 * Werte ueber themes.css fuer Hell- und Dunkelmodus.
 */

const CHART_CB_VARS = [
  "var(--chart-cb-0)",
  "var(--chart-cb-1)",
  "var(--chart-cb-2)",
  "var(--chart-cb-3)",
  "var(--chart-cb-4)",
  "var(--chart-cb-5)",
  "var(--chart-cb-6)",
  "var(--chart-cb-7)",
] as const;

/** Hervorgehobenes Jahr (Konferenz): FOSSGIS-Orange ueber `--chart-emphasis` in themes.css. */
export function chartEmphasisColor(): string {
  return "var(--chart-emphasis)";
}

/**
 * Serie i in Liniendiagrammen (Anmeldungen) und Balkenfarbe Workshop/Exkursion.
 * @param emphasized Aktuelles Hervorheben (Konferenzjahr bei Registrations-Kacheln).
 */
export function registrationsSeriesStrokeColor(index: number, emphasized: boolean): string {
  if (emphasized) {
    return chartEmphasisColor();
  }
  const n = CHART_CB_VARS.length;
  const i = ((index % n) + n) % n;
  return CHART_CB_VARS[i];
}
