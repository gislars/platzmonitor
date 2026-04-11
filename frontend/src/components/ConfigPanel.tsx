import { useId, useState } from "react";
import { THEMES, type ThemeId } from "../themes";
import type { DisplayConfigState } from "../useDisplayConfig";

type Props = {
  config: DisplayConfigState;
};

export function ConfigPanel({ config }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <>
      <button
        type="button"
        className="config-fab"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        title="Anzeige-Einstellungen"
      >
        <span className="config-fab__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="visually-hidden">Anzeige-Einstellungen</span>
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="config-panel"
        >
          <h2 className="config-panel__title" id={`${panelId}-title`}>
            Anzeige
          </h2>
          <label className="config-panel__field">
            <span>Theme</span>
            <select
              value={config.themeId}
              onChange={(e) => config.setThemeId(e.target.value as ThemeId)}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="config-panel__field">
            <span>Kacheln horizontal (Spalten)</span>
            <input
              type="number"
              min={1}
              max={12}
              value={config.cols}
              onChange={(e) => config.setCols(Number(e.target.value))}
            />
          </label>
          <label className="config-panel__field">
            <span>Kacheln vertikal (Zeilen)</span>
            <input
              type="number"
              min={1}
              max={12}
              value={config.rows}
              onChange={(e) => config.setRows(Number(e.target.value))}
            />
          </label>
          <p className="config-panel__hint">Pro Seite: {config.tilesPerPage} Kacheln</p>
          <label className="config-panel__field">
            <span>Seitenwechsel (Sekunden)</span>
            <input
              type="number"
              min={5}
              step={1}
              value={Math.round(config.pageRotationMs / 1000)}
              onChange={(e) => config.setPageRotationMs(Number(e.target.value) * 1000)}
            />
          </label>
          <label className="config-panel__field">
            <span>Daten aktualisieren (Sekunden)</span>
            <input
              type="number"
              min={5}
              step={1}
              value={Math.round(config.pollMs / 1000)}
              onChange={(e) => config.setPollMs(Number(e.target.value) * 1000)}
            />
          </label>
          <label className="config-panel__field">
            <span>Max. Gruppenspalten</span>
            <input
              type="number"
              min={1}
              max={6}
              value={config.maxGroupColumns}
              onChange={(e) => config.setMaxGroupColumns(Number(e.target.value))}
            />
          </label>
          <label className="config-panel__field">
            <span>Seitenrotation Gruppen</span>
            <select
              value={config.groupRotationMode}
              onChange={(e) =>
                config.setGroupRotationMode(e.target.value as "perGroup" | "global")
              }
            >
              <option value="perGroup">Pro Gruppe (eigenes Intervall)</option>
              <option value="global">Gemeinsam (ein Takt für alle)</option>
            </select>
          </label>
          <label className="config-panel__field config-panel__field--checkbox">
            <input
              type="checkbox"
              checked={config.hideEmptyGroups}
              onChange={(e) => config.setHideEmptyGroups(e.target.checked)}
            />
            <span>Leere Gruppen ausblenden</span>
          </label>
          <label className="config-panel__field config-panel__field--checkbox">
            <input
              type="checkbox"
              checked={config.hideSoldOutEntries}
              onChange={(e) => config.setHideSoldOutEntries(e.target.checked)}
            />
            <span>Ausgebuchte Angebote ausblenden</span>
          </label>
          <label className="config-panel__field config-panel__field--checkbox">
            <input
              type="checkbox"
              checked={config.hidePastEntries}
              onChange={(e) => config.setHidePastEntries(e.target.checked)}
            />
            <span>Vergangene Termine ausblenden (nur nach bekanntem Startdatum)</span>
          </label>
          <button type="button" className="config-panel__reset" onClick={config.resetToDefaults}>
            Zurück auf Standard
          </button>
          <button type="button" className="config-panel__close" onClick={() => setOpen(false)}>
            Schließen
          </button>
        </div>
      ) : null}
      {open ? (
        <button
          type="button"
          className="config-panel__backdrop"
          aria-label="Einstellungen schließen"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
