/** Erkennt typische Netzwerk-, Timeout- und 502/503/504-Meldungstexte. */
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
  /** Meldung für die rote Leiste unter den Statistik-Tabs oder null. */
  bannerMessage: string | null;
  /** Bei erkanntem Netzwerkfehler: Hinweis im Dashboard-Kopf statt Tab-Banner. */
  showHeaderUnreachableHint: boolean;
};

/** Wertet die Registrierungen-API-Fehlermeldung für Tab-Banner und Kopfhinweis aus. */
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
