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
const EVENTS_PATH = "/api/v1/events";

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

/** Baut eine schreibbare `URL` aus relativem API-Pfad oder absoluter Adresse (Basis: Fenster oder localhost). */
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

/** Nur Dev: `VITE_SIMULATE_WAITLIST` setzt am ersten Eintrag eine Test-Warteliste. */
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

export async function fetchAvailabilityForEvent(event: string): Promise<AvailabilityResponse> {
  const u = urlForWritableSearchParams(buildAbsoluteUrl(AVAILABILITY_PATH));
  u.searchParams.set("event", event);
  const data = await fetchJson<AvailabilityResponse>(u.toString());
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

export async function fetchRegistrationsForEvent(
  event: string,
  opts?: { include?: string }
): Promise<RegistrationsResponse> {
  const u = urlForWritableSearchParams(buildAbsoluteUrl(REG_PATH));
  u.searchParams.set("event", event);
  if (opts?.include && opts.include.trim()) {
    u.searchParams.set("include", opts.include.trim());
  }
  return fetchJson(u.toString());
}

export type EventsCatalogEntry = {
  slug: string;
  title?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

export type EventsCatalogResponse = {
  fetchedAt: string;
  events: EventsCatalogEntry[];
};

export async function fetchEventsCatalog(): Promise<EventsCatalogResponse> {
  return fetchJson(buildAbsoluteUrl(EVENTS_PATH));
}

/** Lädt die Buchungs-Timeline (tägliche kumulierte Plätze) für eine Quota. */
export async function fetchBookingTimeline(
  quotaId: string,
  opts?: { event?: string; signal?: AbortSignal }
): Promise<BookingTimelineResponse> {
  const timeoutMs = getFetchTimeoutMs();
  const u = urlForWritableSearchParams(buildAbsoluteUrl(BOOKING_TIMELINE_PATH));
  if (opts?.event) {
    u.searchParams.set("event", opts.event);
  }
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
