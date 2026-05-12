import type { Domain } from "../config";

type Props = {
  activeDomain: Domain;
  onSelectDomain: (domain: Domain) => void;
  disabled: boolean;
};

/** Begleitprogramm / Anmeldungen – eine Implementierung fuer Statistik-Shell und optional Kachelmodus. */
export function StatSubTabsNav({ activeDomain, onSelectDomain, disabled }: Props) {
  return (
    <nav className="stat-tabs" aria-label="Bereich-Auswahl in Analysen">
      <button
        type="button"
        className={`stat-tabs__btn${activeDomain === "begleitprogramm" ? " stat-tabs__btn--active" : ""}`}
        aria-pressed={activeDomain === "begleitprogramm"}
        disabled={disabled}
        onClick={() => onSelectDomain("begleitprogramm")}
      >
        Begleitprogramm
      </button>
      <button
        type="button"
        className={`stat-tabs__btn${activeDomain === "anmeldungen" ? " stat-tabs__btn--active" : ""}`}
        aria-pressed={activeDomain === "anmeldungen"}
        disabled={disabled}
        onClick={() => onSelectDomain("anmeldungen")}
      >
        Anmeldungen
      </button>
    </nav>
  );
}
