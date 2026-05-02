import { useId, useState } from "react";
import type { StatisticsTab, ViewMode } from "../config";
import { getKioskMode } from "../kiosk";
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

          <section className="config-panel__section" aria-labelledby={`${panelId}-sec-theme`}>
            <h3 className="config-panel__section-title" id={`${panelId}-sec-theme`}>
              Erscheinungsbild
            </h3>
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
          </section>

          <section className="config-panel__section" aria-labelledby={`${panelId}-sec-mode`}>
            <h3 className="config-panel__section-title" id={`${panelId}-sec-mode`}>
              Modus
            </h3>
            <label className="config-panel__field">
              <span>Hauptansicht</span>
              <select
                value={config.viewMode}
                onChange={(e) => config.setViewMode(e.target.value as ViewMode)}
              >
                <option value="tiles">Freie Plätze</option>
                <option value="statistics">Statistik</option>
              </select>
            </label>
            <label className="config-panel__field">
              <span>Start-Tab unter Statistik</span>
              <select
                value={config.statisticsTab}
                onChange={(e) => config.setStatisticsTab(e.target.value as StatisticsTab)}
                disabled={config.viewMode !== "statistics"}
              >
                <option value="workshops">Begleitprogramm</option>
                <option value="registrations">Anmeldungen</option>
              </select>
            </label>
            {config.viewMode === "statistics" && !getKioskMode() ? (
              <label className="config-panel__field config-panel__field--checkbox">
                <input
                  type="checkbox"
                  checked={config.statsTabAutoRotate}
                  onChange={(e) => config.setStatsTabAutoRotate(e.target.checked)}
                />
                <span>Im Kiosk-Modus Tabs rotieren</span>
              </label>
            ) : null}
          </section>

          <section className="config-panel__section" aria-labelledby={`${panelId}-sec-grid`}>
            <h3 className="config-panel__section-title" id={`${panelId}-sec-grid`}>
              Anordnung und Seiten
            </h3>
            <p className="config-panel__lead">Spalten, Zeilen und Seiten gelten für Freie Plätze und Statistik.</p>
            <div className="config-panel__row2">
              <label className="config-panel__field">
                <span>Spalten</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.cols}
                  onChange={(e) => config.setCols(Number(e.target.value))}
                />
              </label>
              <label className="config-panel__field">
                <span>Zeilen</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.rows}
                  onChange={(e) => config.setRows(Number(e.target.value))}
                />
              </label>
            </div>
            <p className="config-panel__hint">
              Auf einer Seite: {config.tilesPerPage} Kacheln bei effektiven {config.effectiveCols}×
              {config.effectiveRows}.
              {config.effectiveCols < config.cols
                ? " Weniger als eingestellt, wenn „Max. Gruppen-Spalten“ kleiner greift."
                : ""}
            </p>
            <label className="config-panel__field">
              <span>Seitenwechsel alle (Sekunden)</span>
              <input
                type="number"
                min={5}
                step={1}
                value={Math.round(config.pageRotationMs / 1000)}
                onChange={(e) => config.setPageRotationMs(Number(e.target.value) * 1000)}
              />
            </label>
            <label className="config-panel__field">
              <span>Max. Gruppen-Spalten</span>
              <input
                type="number"
                min={1}
                max={6}
                value={config.maxGroupColumns}
                onChange={(e) => config.setMaxGroupColumns(Number(e.target.value))}
              />
            </label>
            <details className="config-panel__details">
              <summary className="config-panel__details-summary">Weitere · Seiten im gleichen Rhythmus</summary>
              <label className="config-panel__field">
                <span>Seitenrhythmus nebeneinander</span>
                <select
                  value={config.groupRotationMode}
                  onChange={(e) =>
                    config.setGroupRotationMode(e.target.value as "perGroup" | "global")
                  }
                >
                  <option value="perGroup">Jede Gruppe getrennt</option>
                  <option value="global">Alle gemeinsam (ein Rhythmus)</option>
                </select>
              </label>
              <p className="config-panel__microhint" role="note">
                Merkt man nur, wenn mehrere Gruppenspalten nebeneinander stehen oder Teillisten über mehrere Seiten
                weiterblättern (Freie Plätze wie Statistik).
              </p>
            </details>
          </section>

          <section className="config-panel__section" aria-labelledby={`${panelId}-sec-data`}>
            <h3 className="config-panel__section-title" id={`${panelId}-sec-data`}>
              Daten und Filter
            </h3>
            <label className="config-panel__field">
              <span>Aktuelle Belegung neu laden (Sekunden)</span>
              <input
                type="number"
                min={5}
                step={1}
                value={Math.round(config.pollMs / 1000)}
                onChange={(e) => config.setPollMs(Number(e.target.value) * 1000)}
              />
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
              <span>Ausgebuchte ausblenden</span>
            </label>
            <label className="config-panel__field config-panel__field--checkbox">
              <input
                type="checkbox"
                checked={config.hidePastEntries}
                onChange={(e) => config.setHidePastEntries(e.target.checked)}
              />
              <span>Vergangene Termine ausblenden</span>
            </label>
          </section>

          <div className="config-panel__actions">
            <button type="button" className="config-panel__reset" onClick={config.resetToDefaults}>
              Zurück auf Standard
            </button>
            <button type="button" className="config-panel__close" onClick={() => setOpen(false)}>
              Schließen
            </button>
          </div>
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
