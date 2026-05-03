export const THEMES = [
  { id: "fossgis-light", label: "FOSSGIS Hell", colorScheme: "light" as const },
  { id: "fossgis-dark", label: "FOSSGIS Dunkel", colorScheme: "dark" as const },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const DEFAULT_THEME_ID: ThemeId = "fossgis-light";

export function isValidThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getDefaultThemeIdFromEnv(): ThemeId {
  const raw = import.meta.env.VITE_DEFAULT_THEME?.trim();
  if (raw && isValidThemeId(raw)) {
    return raw;
  }
  return DEFAULT_THEME_ID;
}

const LS_THEME = "fossgis-platzmonitor.theme";

export function getInitialThemeId(): ThemeId {
  try {
    const stored = localStorage.getItem(LS_THEME);
    if (stored && isValidThemeId(stored)) {
      return stored;
    }
  } catch {
    void 0;
  }
  return getDefaultThemeIdFromEnv();
}

export function applyThemeToDocument(themeId: ThemeId): void {
  document.documentElement.dataset.theme = themeId;
  const entry = THEMES.find((t) => t.id === themeId);
  document.documentElement.style.colorScheme = entry?.colorScheme ?? "light";
}

export function persistThemeId(themeId: ThemeId): void {
  try {
    localStorage.setItem(LS_THEME, themeId);
  } catch {
    void 0;
  }
}

export function clearThemeFromStorage(): void {
  try {
    localStorage.removeItem(LS_THEME);
  } catch {
    void 0;
  }
}

export { LS_THEME, DEFAULT_THEME_ID };
