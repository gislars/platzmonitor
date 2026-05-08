import type { CSSProperties, RefObject } from "react";

type Props = {
  eventTitle: string;
  tagline: string;
  /** Text in der Hilfe-Bubble; leer oder nur Leerzeichen: Zeile ausblenden. */
  helpText: string;
  pollMs: number;
  kiosk: boolean;
  onRefresh: () => void;
  showConnectivityHint: boolean;
  helpSweepRef: RefObject<HTMLSpanElement | null>;
};

/** Gemeinsamer Kopf fuer Kachel- und Statistik-Ansicht (keine Modusverzweigung im Markup). */
export function DashboardMasthead({
  eventTitle,
  tagline,
  helpText,
  pollMs,
  kiosk,
  onRefresh,
  showConnectivityHint,
  helpSweepRef,
}: Props) {
  const showHelpStrip = helpText.trim() !== "";

  return (
    <div className="dashboard__masthead">
      <header className="dashboard__header">
        <div className="dashboard__header-lead" aria-hidden="true" />
        <div className="dashboard__header-center">
          <h1 className="dashboard__title">{eventTitle}</h1>
          <p className="dashboard__tagline">{tagline}</p>
        </div>
        <div className="dashboard__header-actions">
          {!kiosk ? (
            <button type="button" className="dashboard__refresh" onClick={onRefresh}>
              Aktualisieren
            </button>
          ) : null}
        </div>
      </header>

      {showHelpStrip ? (
        <div className="dashboard__tiles-help-strip">
          <p
            className="dashboard__help"
            style={
              {
                "--dashboard-help-rotation-ms": `${pollMs}ms`,
              } as CSSProperties
            }
          >
            <span ref={helpSweepRef} className="dashboard__help-sweep" aria-hidden="true" />
            <span className="dashboard__help-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 16v-4M12 8h.01M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="dashboard__help-text">{helpText.trim()}</span>
          </p>
        </div>
      ) : null}

      <div
        className={`dashboard__connectivity-strip${showConnectivityHint ? " dashboard__connectivity-strip--active" : ""}`}
        role={showConnectivityHint ? "status" : undefined}
        aria-live={showConnectivityHint ? "polite" : undefined}
      >
        {showConnectivityHint ? (
          <p className="dashboard__connectivity-strip__text">
            Keine Verbindung<span className="dashboard__sub-hint"> zum Server</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
