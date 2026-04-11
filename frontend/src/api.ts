import type { AvailabilityResponse } from "./types";

const PATH = "/api/v1/availability";

function getAvailabilityUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!base) return PATH;
  const baseNormalized = base.endsWith("/") ? base : `${base}/`;
  const pathRelative = PATH.startsWith("/") ? PATH.slice(1) : PATH;
  return new URL(pathRelative, baseNormalized).toString();
}

export async function fetchAvailability(): Promise<AvailabilityResponse> {
  const r = await fetch(getAvailabilityUrl());
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
