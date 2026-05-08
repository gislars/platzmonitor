import type { StatisticsTab } from "../config";

type Props = {
  activeTab: StatisticsTab;
  onSelectTab: (tab: StatisticsTab) => void;
  tabButtonsDisabled: boolean;
};

/** Begleitprogramm / Anmeldungen – eine Implementierung fuer Statistik-Shell und optional Kachelmodus. */
export function StatSubTabsNav({ activeTab, onSelectTab, tabButtonsDisabled }: Props) {
  return (
    <nav className="stat-tabs" aria-label="Statistik-Tabs">
      <button
        type="button"
        className={`stat-tabs__btn${activeTab === "workshops" ? " stat-tabs__btn--active" : ""}`}
        aria-pressed={activeTab === "workshops"}
        disabled={tabButtonsDisabled}
        onClick={() => onSelectTab("workshops")}
      >
        Begleitprogramm
      </button>
      <button
        type="button"
        className={`stat-tabs__btn${activeTab === "registrations" ? " stat-tabs__btn--active" : ""}`}
        aria-pressed={activeTab === "registrations"}
        disabled={tabButtonsDisabled}
        onClick={() => onSelectTab("registrations")}
      >
        Anmeldungen
      </button>
    </nav>
  );
}
