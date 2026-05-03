import { useCallback, useMemo, useState } from "react";
import {
  getBuildKioskDefault,
  getDefaultGroupRotationMode,
  getDefaultHideEmptyGroups,
  getDefaultHidePastEntries,
  getDefaultHideSoldOutEntries,
  getDefaultMaxGroupColumns,
  getDefaultPageRotationMs,
  getDefaultStatisticsTab,
  getDefaultTilesCols,
  getDefaultTilesRows,
  getDefaultViewMode,
  getPollIntervalMs,
  MAX_MAX_GROUP_COLUMNS,
  MAX_TILE_DIM,
  MIN_MAX_GROUP_COLUMNS,
  MIN_PAGE_ROTATION_MS,
  MIN_POLL_INTERVAL_MS,
  MIN_TILE_DIM,
  type GroupRotationMode,
  type StatisticsTab,
  type ViewMode,
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
const LS_VIEW_MODE = "fossgis-platzmonitor.viewMode";
const LS_STATS_TAB = "fossgis-platzmonitor.statisticsTab";
const LS_STATS_TAB_AUTOROTATE = "fossgis-platzmonitor.statsTabAutoRotate";

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

function readLsStatisticsTab(key: string, fallback: StatisticsTab): StatisticsTab {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "registrations") {
      return "registrations";
    }
    if (raw === "workshops") {
      return "workshops";
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function readLsViewMode(key: string, fallback: ViewMode): ViewMode {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "statistics") {
      return "statistics";
    }
    if (raw === "tiles") {
      return "tiles";
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
      viewMode: getDefaultViewMode(),
      statisticsTab: getDefaultStatisticsTab(),
      statsTabAutoRotate: getBuildKioskDefault(),
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

  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    readLsViewMode(LS_VIEW_MODE, defaults.viewMode)
  );
  const [statisticsTab, setStatisticsTabState] = useState<StatisticsTab>(() =>
    readLsStatisticsTab(LS_STATS_TAB, defaults.statisticsTab)
  );
  const [statsTabAutoRotate, setStatsTabAutoRotateState] = useState(() =>
    readLsBool(LS_STATS_TAB_AUTOROTATE, defaults.statsTabAutoRotate)
  );

  const setCols = useCallback((n: number) => {
    const v = clampInt(n, MIN_TILE_DIM, MAX_TILE_DIM);
    setColsState(v);
    try {
      localStorage.setItem(LS_COLS, String(v));
    } catch {
      void 0;
    }
  }, []);

  const setRows = useCallback((n: number) => {
    const v = clampInt(n, MIN_TILE_DIM, MAX_TILE_DIM);
    setRowsState(v);
    try {
      localStorage.setItem(LS_ROWS, String(v));
    } catch {
      void 0;
    }
  }, []);

  const setPageRotationMs = useCallback((n: number) => {
    const v = Math.max(MIN_PAGE_ROTATION_MS, Math.floor(n));
    setPageRotationMsState(v);
    try {
      localStorage.setItem(LS_ROTATION, String(v));
    } catch {
      void 0;
    }
  }, []);

  const setPollMs = useCallback((n: number) => {
    const v = Math.max(MIN_POLL_INTERVAL_MS, Math.floor(n));
    setPollMsState(v);
    try {
      localStorage.setItem(LS_POLL, String(v));
    } catch {
      void 0;
    }
  }, []);

  const setMaxGroupColumns = useCallback((n: number) => {
    const v = clampInt(n, MIN_MAX_GROUP_COLUMNS, MAX_MAX_GROUP_COLUMNS);
    setMaxGroupColumnsState(v);
    try {
      localStorage.setItem(LS_MAX_GROUP_COLS, String(v));
    } catch {
      void 0;
    }
  }, []);

  const setGroupRotationMode = useCallback((m: GroupRotationMode) => {
    setGroupRotationModeState(m);
    try {
      localStorage.setItem(LS_GROUP_ROTATION_MODE, m);
    } catch {
      void 0;
    }
  }, []);

  const setHideEmptyGroups = useCallback((v: boolean) => {
    setHideEmptyGroupsState(v);
    try {
      localStorage.setItem(LS_HIDE_EMPTY, v ? "1" : "0");
    } catch {
      void 0;
    }
  }, []);

  const setHideSoldOutEntries = useCallback((v: boolean) => {
    setHideSoldOutEntriesState(v);
    try {
      localStorage.setItem(LS_HIDE_SOLD_OUT, v ? "1" : "0");
    } catch {
      void 0;
    }
  }, []);

  const setHidePastEntries = useCallback((v: boolean) => {
    setHidePastEntriesState(v);
    try {
      localStorage.setItem(LS_HIDE_PAST, v ? "1" : "0");
    } catch {
      void 0;
    }
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    applyThemeToDocument(id);
    persistThemeId(id);
  }, []);

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    try {
      localStorage.setItem(LS_VIEW_MODE, m);
    } catch {
      void 0;
    }
  }, []);

  const setStatisticsTab = useCallback((t: StatisticsTab) => {
    setStatisticsTabState(t);
    try {
      localStorage.setItem(LS_STATS_TAB, t);
    } catch {
      void 0;
    }
  }, []);

  const setStatsTabAutoRotate = useCallback((v: boolean) => {
    setStatsTabAutoRotateState(v);
    try {
      localStorage.setItem(LS_STATS_TAB_AUTOROTATE, v ? "1" : "0");
    } catch {
      void 0;
    }
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
    setViewModeState(defaults.viewMode);
    setStatisticsTabState(defaults.statisticsTab);
    setStatsTabAutoRotateState(defaults.statsTabAutoRotate);
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
      localStorage.removeItem(LS_VIEW_MODE);
      localStorage.removeItem(LS_STATS_TAB);
      localStorage.removeItem(LS_STATS_TAB_AUTOROTATE);
    } catch {
      void 0;
    }
  }, [defaults]);

  /** Effektive Spaltenzahl: eingestellter Wert begrenzt durch `maxGroupColumns`. */
  const effectiveCols = Math.max(MIN_TILE_DIM, Math.min(cols, maxGroupColumns));
  const effectiveRows = Math.max(MIN_TILE_DIM, rows);
  const tilesPerPage = effectiveCols * effectiveRows;

  return {
    cols,
    rows,
    effectiveCols,
    effectiveRows,
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
    viewMode,
    setViewMode,
    statisticsTab,
    setStatisticsTab,
    statsTabAutoRotate,
    setStatsTabAutoRotate,
    resetToDefaults,
    defaults,
  };
}

export type DisplayConfigState = ReturnType<typeof useDisplayConfig>;
