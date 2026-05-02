import type {
  AvailabilityResponse,
  BookingTimelineResponse,
  Entry,
  Group,
  HistoryResponse,
  RegistrationsResponse,
} from "./types";
import { getFetchTimeoutMs } from "./config";

const AVAILABILITY_PATH = "/api/v1/availability";
const HISTORY_PATH = "/api/v1/history";
const REG_PATH = "/api/v1/registrations";
const BOOKING_TIMELINE_PATH = "/api/v1/booking-timeline";

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  return e instanceof Error && e.name === "AbortError";
}

function buildAbsoluteUrl(pathWithLeadingSlash: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!base) {
    return pathWithLeadingSlash;
  }
  const baseNormalized = base.endsWith("/") ? base : `${base}/`;
  const pathRelative = pathWithLeadingSlash.startsWith("/")
    ? pathWithLeadingSlash.slice(1)
    : pathWithLeadingSlash;
  return new URL(pathRelative, baseNormalized).toString();
}

/** Relativen API-Pfad oder absolute URL fuer URLSearchParams in eine URL verwandeln (ohne new URL(Relativ)). */
function urlForWritableSearchParams(apiPathBuilt: string): URL {
  if (apiPathBuilt.startsWith("http://") || apiPathBuilt.startsWith("https://")) {
    return new URL(apiPathBuilt);
  }
  const origin =
    typeof window !== "undefined" && window.location?.origin?.length
      ? window.location.origin
      : "http://localhost";
  return new URL(apiPathBuilt, origin);
}

async function fetchJson<T>(url: string): Promise<T> {
  const timeoutMs = getFetchTimeoutMs();
  let r: Response;
  try {
    r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (isAbortError(e)) {
      throw new Error(`Anfrage abgebrochen (Timeout nach ${timeoutMs} ms)`);
    }
    throw e;
  }
  if (!r.ok) {
    let detail = "";
    const raw = await r.text();
    try {
      const j = JSON.parse(raw) as { message?: string };
      detail = j.message ?? "";
    } catch {
      detail = raw;
    }
    throw new Error(detail.trim() || `HTTP ${String(r.status)}`);
  }
  return r.json() as Promise<T>;
}

/**
 * Nur Vite-Dev: setzt Warteliste am ersten Eintrag (Reihenfolge wie API), um die Anzeige zu pruefen.
 * Endliche UND unbegrenzte Kontingente (pretix oft ohne size = unlimited) sind erlaubt.
 * In `frontend/.env` z. B. `VITE_SIMULATE_WAITLIST=4`, dann nur `pnpm dev` neu starten (nicht das Backend).
 */
function applySimulateWaitlist(data: AvailabilityResponse): AvailabilityResponse {
  if (!import.meta.env.DEV) {
    return data;
  }
  const raw = import.meta.env.VITE_SIMULATE_WAITLIST?.trim();
  if (raw === undefined || raw === "") {
    return data;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return data;
  }
  let applied = false;
  const groups: Group[] = data.groups.map((g) => ({
    ...g,
    entries: g.entries.map((e): Entry => {
      if (applied) {
        return e;
      }
      applied = true;
      const next = {
        ...e,
        waitingListEnabled: true,
        waitingListCount: n,
      };
      console.info(
        `[platzmonitor] VITE_SIMULATE_WAITLIST=${String(n)} fuer ersten Eintrag:`,
        next.label,
        `(${next.id})`
      );
      return next;
    }),
  }));
  return { ...data, groups };
}

export async function fetchAvailability(): Promise<AvailabilityResponse> {
  const data = await fetchJson<AvailabilityResponse>(buildAbsoluteUrl(AVAILABILITY_PATH));
  return applySimulateWaitlist(data);
}

export async function fetchHistory(opts?: {
  since?: Date;
  until?: Date;
  quotaIds?: string[];
}): Promise<HistoryResponse> {
  const u = urlForWritableSearchParams(buildAbsoluteUrl(HISTORY_PATH));
  if (opts?.since != null) {
    u.searchParams.set("since", opts.since.toISOString());
  }
  if (opts?.until != null) {
    u.searchParams.set("until", opts.until.toISOString());
  }
  if (opts?.quotaIds && opts.quotaIds.length > 0) {
    u.searchParams.set("quotaIds", opts.quotaIds.join(","));
  }
  return fetchJson(u.toString());
}

export async function fetchRegistrations(): Promise<RegistrationsResponse> {
  return fetchJson(buildAbsoluteUrl(REG_PATH));
}

/** Kumulativa gebucht aus pretix-Transaktionen (tägliche Stufen UTC), fuer Workshop-Detail. */
export async function fetchBookingTimeline(
  quotaId: string,
  opts?: { signal?: AbortSignal }
): Promise<BookingTimelineResponse> {
  const timeoutMs = getFetchTimeoutMs();
  const u = urlForWritableSearchParams(buildAbsoluteUrl(BOOKING_TIMELINE_PATH));
  u.searchParams.set("quotaIds", quotaId);
  let r: Response;
  try {
    r = await fetch(u.toString(), {
      signal: opts?.signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (isAbortError(e)) {
      throw new Error(`Anfrage abgebrochen (Timeout oder Abbruch, ${timeoutMs} ms Budget)`);
    }
    throw e;
  }
  if (!r.ok) {
    let detail = "";
    const raw = await r.text();
    try {
      const j = JSON.parse(raw) as { message?: string };
      detail = j.message ?? "";
    } catch {
      detail = raw;
    }
    throw new Error(detail.trim() || `HTTP ${String(r.status)}`);
  }
  return r.json() as Promise<BookingTimelineResponse>;
}
