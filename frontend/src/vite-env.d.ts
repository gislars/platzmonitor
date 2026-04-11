/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: anderes API-Backend. Wenn gesetzt, wird PATH relativ zu dieser Base gebaut. */
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_POLL_INTERVAL_MS?: string;
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
