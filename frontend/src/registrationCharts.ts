import type { RegistrationsEventSerie, RegistrationsPoint } from "./types";

/** Omits snapshots after conference start (negative weeksBefore from API). */
export function pointsThroughConferenceStart(pts: readonly RegistrationsPoint[]): RegistrationsPoint[] {
  return pts.filter((p) => p.weeksBefore >= 0);
}

export function formatRegistrationsCountDe(n: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export type RegistrationsChannelMode = "online" | "onsite" | "total";

/** Kartenmodus ohne verbotene Kombination («vor Ort», obwohl keine Daten). */
export function resolveRegistrationsChannelMode(
  mode: RegistrationsChannelMode,
  onsitePossible: boolean
): RegistrationsChannelMode {
  return !onsitePossible && mode === "onsite" ? "online" : mode;
}

export function formatRegistrationsWeeklyHoverCaption(weeks: number, val: number): string {
  const w = String(Math.round(weeks));
  return `Woche ${w}: ${formatRegistrationsCountDe(val)}`;
}

/** Kumulativa zum Stützpunkt `weeksBefore` (nicht Zuwächse). */
export function formatRegistrationsCumulativeHoverCaption(weeks: number, val: number): string {
  const w = String(Math.round(weeks));
  return `${w} Wochen · kumuliert ${formatRegistrationsCountDe(val)}`;
}

export function registrationsHasAnyOnsite(events: readonly RegistrationsEventSerie[]): boolean {
  return events.some((ev) => ev.points.some((p) => p.onsite != null && p.weeksBefore >= 0));
}

/** Zählerstand pro Kanal (für Kumulativa oder Tag-zu-Tag-Differenz). */
export function registrationsChannelValue(mode: RegistrationsChannelMode, p: RegistrationsPoint): number {
  if (mode === "online") {
    return p.online;
  }
  if (mode === "onsite") {
    return p.onsite ?? 0;
  }
  return p.online + (p.onsite ?? 0);
}
