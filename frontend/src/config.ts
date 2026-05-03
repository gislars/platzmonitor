/** Intervall für Verfügbarkeits-Polling; `VITE_POLL_INTERVAL_MS`, min. 5 s, Vorgabe 55 s. */
const DEFAULT_POLL_INTERVAL_MS = 55_000;
export const MIN_POLL_INTERVAL_MS = 5_000;

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const MIN_FETCH_TIMEOUT_MS = 5_000;
const MAX_FETCH_TIMEOUT_MS = 120_000;

const DEFAULT_TILES_COLS = 2;
const DEFAULT_TILES_ROWS = 3;
export const MIN_TILE_DIM = 1;
export const MAX_TILE_DIM = 12;

const DEFAULT_PAGE_ROTATION_MS = 25_000;
export const MIN_PAGE_ROTATION_MS = 5_000;

function parsePositiveIntEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max?: number
): number {
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  let v = Math.max(min, n);
  if (max !== undefined) {
    v = Math.min(max, v);
  }
  return v;
}

export function getPollIntervalMs(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
    MIN_POLL_INTERVAL_MS
  );
}

/** Timeout pro `fetch` ans Backend; `VITE_FETCH_TIMEOUT_MS`, 5 s–120 s, Vorgabe 30 s. */
export function getFetchTimeoutMs(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_FETCH_TIMEOUT_MS,
    DEFAULT_FETCH_TIMEOUT_MS,
    MIN_FETCH_TIMEOUT_MS,
    MAX_FETCH_TIMEOUT_MS
  );
}

export function getDefaultTilesCols(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_TILES_COLS,
    DEFAULT_TILES_COLS,
    MIN_TILE_DIM,
    MAX_TILE_DIM
  );
}

export function getDefaultTilesRows(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_TILES_ROWS,
    DEFAULT_TILES_ROWS,
    MIN_TILE_DIM,
    MAX_TILE_DIM
  );
}

export function getDefaultPageRotationMs(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_PAGE_ROTATION_MS,
    DEFAULT_PAGE_ROTATION_MS,
    MIN_PAGE_ROTATION_MS
  );
}

export function getBuildKioskDefault(): boolean {
  return import.meta.env.VITE_KIOSK === "true";
}

const DEFAULT_MAX_GROUP_COLUMNS = 2;
export const MIN_MAX_GROUP_COLUMNS = 1;
export const MAX_MAX_GROUP_COLUMNS = 6;

export type GroupRotationMode = "perGroup" | "global";

export function getDefaultMaxGroupColumns(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_MAX_GROUP_COLUMNS,
    DEFAULT_MAX_GROUP_COLUMNS,
    MIN_MAX_GROUP_COLUMNS,
    MAX_MAX_GROUP_COLUMNS
  );
}

export function getDefaultGroupRotationMode(): GroupRotationMode {
  const raw = import.meta.env.VITE_GROUP_ROTATION_MODE;
  if (raw === "global") {
    return "global";
  }
  return "perGroup";
}

export function getDefaultHideEmptyGroups(): boolean {
  const raw = import.meta.env.VITE_HIDE_EMPTY_GROUPS;
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

export function getDefaultHideSoldOutEntries(): boolean {
  const raw = import.meta.env.VITE_HIDE_SOLD_OUT_ENTRIES;
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

export function getDefaultHidePastEntries(): boolean {
  const raw = import.meta.env.VITE_HIDE_PAST_ENTRIES;
  if (raw === undefined || raw === "") {
    return false;
  }
  return raw === "1" || raw.toLowerCase() === "true";
}

/** Standard-Theme aus `VITE_DEFAULT_THEME` (siehe THEMES). */
export { getDefaultThemeIdFromEnv, THEMES, type ThemeId } from "./themes";

export type ViewMode = "tiles" | "statistics";
export type StatisticsTab = "workshops" | "registrations";

export function getDefaultViewMode(): ViewMode {
  const raw = import.meta.env.VITE_DEFAULT_VIEW_MODE?.trim();
  if (raw === "statistics") {
    return "statistics";
  }
  return "tiles";
}

export function getDefaultStatisticsTab(): StatisticsTab {
  const raw = import.meta.env.VITE_DEFAULT_STATS_TAB?.trim();
  if (raw === "registrations") {
    return "registrations";
  }
  return "workshops";
}

/** Intervall für Registrierungs-Aggregation; `VITE_REGISTRATIONS_POLL_MS`, Vorgabe 1 h. */
export function getRegistrationsPollIntervalMs(): number {
  return parsePositiveIntEnv(
    import.meta.env.VITE_REGISTRATIONS_POLL_MS,
    3_600_000,
    MIN_POLL_INTERVAL_MS,
    3_600_000 * 24
  );
}
