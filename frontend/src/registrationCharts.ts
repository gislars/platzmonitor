import type { RegistrationsEventSerie, RegistrationsPoint } from "./types";

/** Messpunkte mit `weeksBefore` ≥ 0 (Zeitraum bis zum Konferenzbeginn). */
export function pointsThroughConferenceStart(pts: readonly RegistrationsPoint[]): RegistrationsPoint[] {
  return pts.filter((p) => p.weeksBefore >= 0);
}

/** Ganzzahl mit de-DE-Tausendertrennzeichen. */
export function formatRegistrationsCountDe(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export type RegistrationsChannelMode = "online" | "onsite" | "total";

/** Beschriftung der Y-Achse im Anmeldungs-LineChart: Anmeldezahl je Kanal in Klammern. */
export const registrationsYAxisLabel: Record<RegistrationsChannelMode, string> = {
  online: "Anmeldungen (Online)",
  onsite: "Anmeldungen (Vor Ort)",
  total: "Anmeldungen (Gesamt)",
};

/** Mappt Kanal «onsite» auf «online», wenn keine Vor-Ort-Daten vorliegen. */
export function resolveRegistrationsChannelMode(
  mode: RegistrationsChannelMode,
  onsitePossible: boolean
): RegistrationsChannelMode {
  return !onsitePossible && mode === "onsite" ? "online" : mode;
}

/** Tooltip für die pro-Woche-Kurve: Wochen vor Konferenzbeginn (X-Wert) und Anmeldezahl im Intervall. */
export function formatRegistrationsWeeklyHoverCaption(weeks: number, val: number): string {
  const w = String(Math.round(weeks));
  return `Woche ${w}: ${formatRegistrationsCountDe(val)}`;
}

/** Tooltip-Zeile für die kumulierte Ansicht: Abstand in Wochen zum Konferenzbeginn und kumulierter Stand. */
export function formatRegistrationsCumulativeHoverCaption(weeks: number, val: number): string {
  const w = String(Math.round(weeks));
  return `${w} Wochen · kumuliert ${formatRegistrationsCountDe(val)}`;
}

/** Prüft, ob irgendwo Onsite-Werte vor Konferenzbeginn vorkommen. */
export function registrationsHasAnyOnsite(events: readonly RegistrationsEventSerie[]): boolean {
  return events.some((ev) => ev.points.some((p) => p.onsite != null && p.weeksBefore >= 0));
}

/** Anmeldezählerstand eines Zeitpunkts: online, vor Ort oder Summe aus beiden. */
export function registrationsChannelValue(mode: RegistrationsChannelMode, p: RegistrationsPoint): number {
  if (mode === "online") {
    return p.online;
  }
  if (mode === "onsite") {
    return p.onsite ?? 0;
  }
  return p.online + (p.onsite ?? 0);
}
