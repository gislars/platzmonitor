/** Hinweise die typischerweise Verbindungs- oder Reverse-Proxy-Fehler meinen (ohne garantierte Zuordnung). */
const REACHABLE_FALSE_POSITIVE_SAFE = /\b(?:failed to fetch|load failed|network error|abort|timeout)\b/i;

export function isUnreachableApiErrorMessage(message: string): boolean {
  const m = message.trim();
  if (!m) {
    return false;
  }
  if (REACHABLE_FALSE_POSITIVE_SAFE.test(m)) {
    return true;
  }
  if (/\bnetworkrequestfailed\b/i.test(m)) {
    return true;
  }
  if (/^HTTP (502|503|504)\b/.test(m)) {
    return true;
  }
  if (/Anfrage abgebrochen.*Timeout/i.test(m)) {
    return true;
  }
  return /\bfetch\b/i.test(m);
}

export type StatisticsFetchErrorSummary = {
  /** Für rote Hinweisleiste unter den Tabs; null wenn nur der Header-Hinweis genügt */
  bannerMessage: string | null;
  /** Anmeldungen-API nicht erreichbar (Netzwerk oder typische Proxy-Fehler): Hinweis wie im Kachelmodus im Kopf */
  showHeaderUnreachableHint: boolean;
};

/**
 * Fehler der Registrierungen-API im Statistikmodus.
 * Verlaufs-API `/history` wird im Client nicht periodisch abgefragt (aktuell keine Anzeige davon).
 */
export function summarizeStatisticsFetchErrors(registrationsError: string | null): StatisticsFetchErrorSummary {
  const r = registrationsError?.trim() ?? null;
  if (r === null) {
    return { bannerMessage: null, showHeaderUnreachableHint: false };
  }
  const rUnreachable = isUnreachableApiErrorMessage(r);
  if (rUnreachable) {
    return {
      bannerMessage: null,
      showHeaderUnreachableHint: true,
    };
  }
  return { bannerMessage: r, showHeaderUnreachableHint: false };
}
