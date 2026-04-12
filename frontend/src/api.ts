import type { AvailabilityResponse } from "./types";
import { getFetchTimeoutMs } from "./config";

const PATH = "/api/v1/availability";

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  return e instanceof Error && e.name === "AbortError";
}

function getAvailabilityUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!base) return PATH;
  const baseNormalized = base.endsWith("/") ? base : `${base}/`;
  const pathRelative = PATH.startsWith("/") ? PATH.slice(1) : PATH;
  return new URL(pathRelative, baseNormalized).toString();
}

export async function fetchAvailability(): Promise<AvailabilityResponse> {
  const timeoutMs = getFetchTimeoutMs();
  let r: Response;
  try {
    r = await fetch(getAvailabilityUrl(), {
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
    try {
      const j = (await r.json()) as { message?: string };
      detail = j.message ?? "";
    } catch {
      detail = await r.text();
    }
    throw new Error(detail || `HTTP ${r.status}`);
  }
  return r.json() as Promise<AvailabilityResponse>;
}
