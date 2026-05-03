/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Basis-URL des Backends; relative API-Pfade werden daran angehängt. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_POLL_INTERVAL_MS?: string;
  readonly VITE_FETCH_TIMEOUT_MS?: string;
  readonly VITE_TILES_COLS?: string;
  readonly VITE_TILES_ROWS?: string;
  readonly VITE_PAGE_ROTATION_MS?: string;
  readonly VITE_KIOSK?: string;
  readonly VITE_MAX_GROUP_COLUMNS?: string;
  readonly VITE_GROUP_ROTATION_MODE?: string;
  readonly VITE_HIDE_EMPTY_GROUPS?: string;
  readonly VITE_HIDE_SOLD_OUT_ENTRIES?: string;
  readonly VITE_HIDE_PAST_ENTRIES?: string;
  readonly VITE_DEFAULT_THEME?: string;
  readonly VITE_DEFAULT_VIEW_MODE?: string;
  readonly VITE_DEFAULT_STATS_TAB?: string;
  readonly VITE_REGISTRATIONS_POLL_MS?: string;
  /** Nur Dev: nicht-negative Zahl simuliert Warteliste am ersten Listeneintrag. */
  readonly VITE_SIMULATE_WAITLIST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
