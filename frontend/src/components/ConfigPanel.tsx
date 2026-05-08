import type { EventsCatalogEntry } from "../api";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { StatisticsTab, ViewMode } from "../config";
import { getKioskMode } from "../kiosk";
import { THEMES, type ThemeId } from "../themes";
import type { DisplayConfigState } from "../useDisplayConfig";
import { useEventsCatalog } from "../useEventsCatalog";

type Props = {
  config: DisplayConfigState;
};

function eventOptionLabel(ev: EventsCatalogEntry): string {
  const t = (ev.title ?? "").trim();
  const s = (ev.slug ?? "").trim();
  if (t && s && t !== s) {
    return `${t} (${s})`;
  }
  if (t) {
    return t;
  }
  return s || ev.slug;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.matches(":disabled")) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") {
      return false;
    }
    if (el.closest('[aria-hidden="true"]')) {
      return false;
    }
    return true;
  });
}

export function ConfigPanel({ config }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(open);
  const { sortedEvents, error: eventsError, events } = useEventsCatalog(true);

  const defaultEventSlug = sortedEvents[0]?.slug ?? "";

  const closePanel = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!defaultEventSlug) {
      return;
    }
    if (config.eventSlug && config.eventSlug.trim()) {
      return;
    }
    config.setEventSlug(defaultEventSlug);
  }, [config, defaultEventSlug]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement && root.contains(active)) {
        return;
      }
      const nodes = getFocusableElements(root);
      (nodes[0] ?? root).focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (prevOpen.current && !open) {
      fabRef.current?.focus();
    }
    prevOpen.current = open;
  }, [open]);

  const handlePanelKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") {
      return;
    }
    const root = panelRef.current;
    if (!root) {
      return;
    }
    const nodes = getFocusableElements(root);
    if (nodes.length === 0) {
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        className="config-fab"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
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
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${panelId}-title`}
          className="config-panel"
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
        >
          <h2 className="config-panel__title" id={`${panelId}-title`}>
            Anzeige
          </h2>

          <div className="config-panel__quick">
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
              <span>Konferenz</span>
              <select
                value={config.eventSlug || defaultEventSlug}
                onChange={(e) => config.setEventSlug(e.target.value)}
                disabled={events === null && eventsError !== null}
              >
                {sortedEvents.length === 0 ? (
                  <option value={config.eventSlug || ""}>
                    {eventsError ? "Veranstaltungen nicht konfiguriert" : "Liste wird geladen"}
                  </option>
                ) : (
                  sortedEvents.map((ev) => (
                    <option key={ev.slug} value={ev.slug}>
                      {eventOptionLabel(ev)}
                    </option>
                  ))
                )}
              </select>
            </label>
            {sortedEvents.length === 0 && eventsError ? (
              <p className="config-panel__microhint" role="note">
                Im Backend fehlt die Konfiguration <code>EVENTS_JSON</code>.
              </p>
            ) : null}
          </div>

          <details className="config-panel__accordion">
            <summary className="config-panel__accordion-summary">Ansicht</summary>
            <div className="config-panel__accordion-body">
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
                    aria-describedby={`${panelId}-kiosk-rotate-hint`}
                    onChange={(e) => config.setStatsTabAutoRotate(e.target.checked)}
                  />
                  <span>Zwischen Begleitprogramm und Anmeldungen wechseln (Kiosk-Modus)</span>
                </label>
              ) : null}
              {config.viewMode === "statistics" && !getKioskMode() ? (
                <p className="config-panel__microhint" role="note" id={`${panelId}-kiosk-rotate-hint`}>
                  Gilt nur, wenn die Seite mit <code>?kiosk=1</code> oder als Kiosk-Build geöffnet wird.
                </p>
              ) : null}
              {config.viewMode === "statistics" ? (
                <label className="config-panel__field config-panel__field--checkbox">
                  <input
                    type="checkbox"
                    checked={config.registrationsIncludePrevious}
                    onChange={(e) => config.setRegistrationsIncludePrevious(e.target.checked)}
                  />
                  <span>Vorjahre in Anmeldungsdiagrammen einblenden</span>
                </label>
              ) : null}
            </div>
          </details>

          <details className="config-panel__accordion">
            <summary className="config-panel__accordion-summary">Raster und Blättern</summary>
            <div className="config-panel__accordion-body">
              <p className="config-panel__lead">
                Spalten, Zeilen und Seiten gelten für Freie Plätze und Statistik.
              </p>
              <div className="config-panel__row2">
                <label className="config-panel__field">
                  <span>Spalten</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={config.cols}
                    aria-describedby={`${panelId}-grid-hint`}
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
                    aria-describedby={`${panelId}-grid-hint`}
                    onChange={(e) => config.setRows(Number(e.target.value))}
                  />
                </label>
              </div>
              <p className="config-panel__hint" id={`${panelId}-grid-hint`}>
                Auf einer Seite: {config.tilesPerPage} Kacheln bei effektiven {config.effectiveCols}×
                {config.effectiveRows}.
                {config.effectiveCols < config.cols
                  ? " Weniger als eingestellt, wenn die maximale Anzahl Gruppen-Spalten kleiner greift."
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
                <summary className="config-panel__details-summary">
                  Erweitert: Seitenwechsel über mehrere Gruppen
                </summary>
                <label className="config-panel__field">
                  <span>Seitenrhythmus nebeneinander</span>
                  <select
                    value={config.groupRotationMode}
                    aria-describedby={`${panelId}-rotation-hint`}
                    onChange={(e) =>
                      config.setGroupRotationMode(e.target.value as "perGroup" | "global")
                    }
                  >
                    <option value="perGroup">Jede Gruppe getrennt</option>
                    <option value="global">Alle gemeinsam (ein Rhythmus)</option>
                  </select>
                </label>
                <p className="config-panel__microhint" role="note" id={`${panelId}-rotation-hint`}>
                  Nur sichtbar, wenn mehrere Gruppenspalten nebeneinander stehen oder Teillisten über mehrere Seiten
                  weiterblättern (Freie Plätze und Statistik).
                </p>
              </details>
            </div>
          </details>

          <details className="config-panel__accordion">
            <summary className="config-panel__accordion-summary">Daten und Filter</summary>
            <div className="config-panel__accordion-body">
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
            </div>
          </details>

          <details className="config-panel__accordion">
            <summary className="config-panel__accordion-summary">Hilfetexte</summary>
            <div className="config-panel__accordion-body">
              <p className="config-panel__lead">
                Je Ansicht ein kurzer Text über der Ansicht. Leer lassen blendet die Zeile aus. Mit
                „Zurück auf Standard“ unten stellen Sie die Vorgaben der Installation wieder her (max. 500 Zeichen).
              </p>
              <label className="config-panel__field">
                <span>Freie Plätze</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={config.helpBubbleTiles}
                  onChange={(e) => config.setHelpBubbleTiles(e.target.value)}
                />
              </label>
              <label className="config-panel__field">
                <span>Statistik</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={config.helpBubbleStatistics}
                  onChange={(e) => config.setHelpBubbleStatistics(e.target.value)}
                />
              </label>
            </div>
          </details>

          <div className="config-panel__actions">
            <button type="button" className="config-panel__close" onClick={closePanel}>
              Schließen
            </button>
            <button type="button" className="config-panel__reset" onClick={config.resetToDefaults}>
              Zurück auf Standard
            </button>
          </div>
        </div>
      ) : null}
      {open ? (
        <button
          type="button"
          className="config-panel__backdrop"
          tabIndex={-1}
          aria-label="Einstellungen schließen"
          onClick={closePanel}
        />
      ) : null}
    </>
  );
}
