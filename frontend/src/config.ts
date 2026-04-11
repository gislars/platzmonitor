/** Standard: 55 s. Überschreiben mit `VITE_POLL_INTERVAL_MS` (Millisekunden, min. 5000). */
const DEFAULT_POLL_INTERVAL_MS = 55_000;
export const MIN_POLL_INTERVAL_MS = 5_000;

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

/** Build-Default für das UI-Theme: `VITE_DEFAULT_THEME` (Ids aus `THEMES`, sonst `fossgis-light`). */
export { getDefaultThemeIdFromEnv, THEMES, type ThemeId } from "./themes";
