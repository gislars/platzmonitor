import { useCallback, useMemo, useState } from "react";
import {
  getDefaultGroupRotationMode,
  getDefaultHideEmptyGroups,
  getDefaultHidePastEntries,
  getDefaultHideSoldOutEntries,
  getDefaultMaxGroupColumns,
  getDefaultPageRotationMs,
  getDefaultTilesCols,
  getDefaultTilesRows,
  getPollIntervalMs,
  MAX_MAX_GROUP_COLUMNS,
  MAX_TILE_DIM,
  MIN_MAX_GROUP_COLUMNS,
  MIN_PAGE_ROTATION_MS,
  MIN_POLL_INTERVAL_MS,
  MIN_TILE_DIM,
  type GroupRotationMode,
} from "./config";
import {
  applyThemeToDocument,
  clearThemeFromStorage,
  getDefaultThemeIdFromEnv,
  getInitialThemeId,
  persistThemeId,
  type ThemeId,
} from "./themes";

const LS_COLS = "fossgis-platzmonitor.tilesCols";
const LS_ROWS = "fossgis-platzmonitor.tilesRows";
const LS_ROTATION = "fossgis-platzmonitor.pageRotationMs";
const LS_POLL = "fossgis-platzmonitor.pollIntervalMs";
const LS_MAX_GROUP_COLS = "fossgis-platzmonitor.maxGroupColumns";
const LS_GROUP_ROTATION_MODE = "fossgis-platzmonitor.groupRotationMode";
const LS_HIDE_EMPTY = "fossgis-platzmonitor.hideEmptyGroups";
const LS_HIDE_SOLD_OUT = "fossgis-platzmonitor.hideSoldOutEntries";
const LS_HIDE_PAST = "fossgis-platzmonitor.hidePastEntries";

function readLsInt(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === "") {
      return fallback;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readLsBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === "") {
      return fallback;
    }
    if (raw === "1" || raw.toLowerCase() === "true") {
      return true;
    }
    if (raw === "0" || raw.toLowerCase() === "false") {
      return false;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function readLsRotationMode(key: string, fallback: GroupRotationMode): GroupRotationMode {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "global") {
      return "global";
    }
    if (raw === "perGroup") {
      return "perGroup";
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function useDisplayConfig() {
  const defaults = useMemo(
    () => ({
      cols: getDefaultTilesCols(),
      rows: getDefaultTilesRows(),
      pageRotationMs: getDefaultPageRotationMs(),
      pollMs: getPollIntervalMs(),
      maxGroupColumns: getDefaultMaxGroupColumns(),
      groupRotationMode: getDefaultGroupRotationMode(),
      hideEmptyGroups: getDefaultHideEmptyGroups(),
      hideSoldOutEntries: getDefaultHideSoldOutEntries(),
      hidePastEntries: getDefaultHidePastEntries(),
      themeId: getDefaultThemeIdFromEnv(),
    }),
    []
  );

  const [cols, setColsState] = useState(() =>
    clampInt(readLsInt(LS_COLS, defaults.cols), MIN_TILE_DIM, MAX_TILE_DIM)
  );
  const [rows, setRowsState] = useState(() =>
    clampInt(readLsInt(LS_ROWS, defaults.rows), MIN_TILE_DIM, MAX_TILE_DIM)
  );
  const [pageRotationMs, setPageRotationMsState] = useState(() =>
    Math.max(MIN_PAGE_ROTATION_MS, readLsInt(LS_ROTATION, defaults.pageRotationMs))
  );
  const [pollMs, setPollMsState] = useState(() =>
    Math.max(MIN_POLL_INTERVAL_MS, readLsInt(LS_POLL, defaults.pollMs))
  );
  const [maxGroupColumns, setMaxGroupColumnsState] = useState(() =>
    clampInt(
      readLsInt(LS_MAX_GROUP_COLS, defaults.maxGroupColumns),
      MIN_MAX_GROUP_COLUMNS,
      MAX_MAX_GROUP_COLUMNS
    )
  );
  const [groupRotationMode, setGroupRotationModeState] = useState<GroupRotationMode>(() =>
    readLsRotationMode(LS_GROUP_ROTATION_MODE, defaults.groupRotationMode)
  );
  const [hideEmptyGroups, setHideEmptyGroupsState] = useState(() =>
    readLsBool(LS_HIDE_EMPTY, defaults.hideEmptyGroups)
  );
  const [hideSoldOutEntries, setHideSoldOutEntriesState] = useState(() =>
    readLsBool(LS_HIDE_SOLD_OUT, defaults.hideSoldOutEntries)
  );
  const [hidePastEntries, setHidePastEntriesState] = useState(() =>
    readLsBool(LS_HIDE_PAST, defaults.hidePastEntries)
  );
  const [themeId, setThemeIdState] = useState<ThemeId>(() => getInitialThemeId());

  const setCols = useCallback((n: number) => {
    const v = clampInt(n, MIN_TILE_DIM, MAX_TILE_DIM);
    setColsState(v);
    try {
      localStorage.setItem(LS_COLS, String(v));
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setRows = useCallback((n: number) => {
    const v = clampInt(n, MIN_TILE_DIM, MAX_TILE_DIM);
    setRowsState(v);
    try {
      localStorage.setItem(LS_ROWS, String(v));
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setPageRotationMs = useCallback((n: number) => {
    const v = Math.max(MIN_PAGE_ROTATION_MS, Math.floor(n));
    setPageRotationMsState(v);
    try {
      localStorage.setItem(LS_ROTATION, String(v));
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setPollMs = useCallback((n: number) => {
    const v = Math.max(MIN_POLL_INTERVAL_MS, Math.floor(n));
    setPollMsState(v);
    try {
      localStorage.setItem(LS_POLL, String(v));
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setMaxGroupColumns = useCallback((n: number) => {
    const v = clampInt(n, MIN_MAX_GROUP_COLUMNS, MAX_MAX_GROUP_COLUMNS);
    setMaxGroupColumnsState(v);
    try {
      localStorage.setItem(LS_MAX_GROUP_COLS, String(v));
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setGroupRotationMode = useCallback((m: GroupRotationMode) => {
    setGroupRotationModeState(m);
    try {
      localStorage.setItem(LS_GROUP_ROTATION_MODE, m);
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setHideEmptyGroups = useCallback((v: boolean) => {
    setHideEmptyGroupsState(v);
    try {
      localStorage.setItem(LS_HIDE_EMPTY, v ? "1" : "0");
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setHideSoldOutEntries = useCallback((v: boolean) => {
    setHideSoldOutEntriesState(v);
    try {
      localStorage.setItem(LS_HIDE_SOLD_OUT, v ? "1" : "0");
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setHidePastEntries = useCallback((v: boolean) => {
    setHidePastEntriesState(v);
    try {
      localStorage.setItem(LS_HIDE_PAST, v ? "1" : "0");
    } catch {
      /* Fehler ignorieren */
    }
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    applyThemeToDocument(id);
    persistThemeId(id);
  }, []);

  const resetToDefaults = useCallback(() => {
    setColsState(defaults.cols);
    setRowsState(defaults.rows);
    setPageRotationMsState(defaults.pageRotationMs);
    setPollMsState(defaults.pollMs);
    setMaxGroupColumnsState(defaults.maxGroupColumns);
    setGroupRotationModeState(defaults.groupRotationMode);
    setHideEmptyGroupsState(defaults.hideEmptyGroups);
    setHideSoldOutEntriesState(defaults.hideSoldOutEntries);
    setHidePastEntriesState(defaults.hidePastEntries);
    setThemeIdState(defaults.themeId);
    applyThemeToDocument(defaults.themeId);
    clearThemeFromStorage();
    try {
      localStorage.removeItem(LS_COLS);
      localStorage.removeItem(LS_ROWS);
      localStorage.removeItem(LS_ROTATION);
      localStorage.removeItem(LS_POLL);
      localStorage.removeItem(LS_MAX_GROUP_COLS);
      localStorage.removeItem(LS_GROUP_ROTATION_MODE);
      localStorage.removeItem(LS_HIDE_EMPTY);
      localStorage.removeItem(LS_HIDE_SOLD_OUT);
      localStorage.removeItem(LS_HIDE_PAST);
    } catch {
      /* Fehler ignorieren */
    }
  }, [defaults]);

  const tilesPerPage = cols * rows;

  return {
    cols,
    rows,
    tilesPerPage,
    pageRotationMs,
    pollMs,
    maxGroupColumns,
    groupRotationMode,
    hideEmptyGroups,
    hideSoldOutEntries,
    hidePastEntries,
    setCols,
    setRows,
    setPageRotationMs,
    setPollMs,
    setMaxGroupColumns,
    setGroupRotationMode,
    setHideEmptyGroups,
    setHideSoldOutEntries,
    setHidePastEntries,
    themeId,
    setThemeId,
    resetToDefaults,
    defaults,
  };
}

export type DisplayConfigState = ReturnType<typeof useDisplayConfig>;
