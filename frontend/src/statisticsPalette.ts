/** Farben für Diagramm-Serien; CSS-Variablen in themes.css (barrierearme Palette). */

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

/** Akzentfarbe für hervorgehobene Serie (CSS-Variable `--chart-emphasis`). */
export function chartEmphasisColor(): string {
  return "var(--chart-emphasis)";
}

/** Strichfarbe für Reihe `index`; bei `emphasized` die Akzentfarbe. */
export function registrationsSeriesStrokeColor(index: number, emphasized: boolean): string {
  if (emphasized) {
    return chartEmphasisColor();
  }
  const n = CHART_CB_VARS.length;
  const i = ((index % n) + n) % n;
  return CHART_CB_VARS[i];
}
