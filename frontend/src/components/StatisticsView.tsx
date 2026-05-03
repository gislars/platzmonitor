import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { StatisticsTab } from "../config";
import { sortEntriesByLabelAsc } from "../sortEntries";
import type { Entry, Group, RegistrationsResponse } from "../types";
import type { DisplayConfigState } from "../useDisplayConfig";
import { BookingHistoryChart } from "./BookingHistoryChart";
import { PaginatedTileGrid } from "./PaginatedTileGrid";
import { RegistrationsCumulativeTile } from "./RegistrationsCumulativeTile";
import { RegistrationsLegend } from "./RegistrationsLegend";
import { RegistrationsWeeklyTile } from "./RegistrationsWeeklyTile";

const REGISTRATIONS_CHART_PAGE_KEYS: ("weekly" | "cumulative")[] = ["weekly", "cumulative"];

/** Trennt Einträge der Gruppe «excursions» von übrigen Workshops für die Statistik-Charts. */
function splitBookingHistoryEntries(groups: readonly Group[]): {
  excursionEntries: Entry[];
  workshopEntries: Entry[];
} {
  const excursionFlat: Entry[] = [];
  const workshopFlat: Entry[] = [];
  for (const g of groups) {
    if (g.id === "excursions") {
      excursionFlat.push(...g.entries);
    } else {
      workshopFlat.push(...g.entries);
    }
  }
  return {
    excursionEntries: sortEntriesByLabelAsc(excursionFlat),
    workshopEntries: sortEntriesByLabelAsc(workshopFlat),
  };
}

type Props = {
  displayConfig: DisplayConfigState;
  kiosk: boolean;
  /** Zeitstempel der Verfügbarkeitsdaten (pretix) für Balkendiagramme. */
  availabilityFetchedAt?: string | null;
  /** Zeitstempel der Registrierungsaggregation für Anmeldungsdiagramme. */
  registrationsFetchedAt?: string | null;
  visibleGroups: Group[];
  registrations: RegistrationsResponse | null;
  statsError: string | null;
  /** Statistik-APIs nicht erreichbar: Hinweis im Kopfbereich statt rotem Tab-Banner. */
  statsServerUnreachable?: boolean;
  globalPageIndex: number;
  onGlobalPageSelect: (index: number) => void;
  onOpenEntryDetail?: (entry: Entry) => void;
};

export function StatisticsView({
  displayConfig,
  kiosk,
  availabilityFetchedAt,
  registrationsFetchedAt,
  visibleGroups,
  registrations,
  statsError,
  statsServerUnreachable = false,
  globalPageIndex,
  onGlobalPageSelect,
  onOpenEntryDetail,
}: Props) {
  const { statisticsTab, statsTabAutoRotate, pageRotationMs, setStatisticsTab } = displayConfig;

  const statisticsTabRef = useRef(statisticsTab);
  useLayoutEffect(() => {
    statisticsTabRef.current = statisticsTab;
  }, [statisticsTab]);

  useEffect(() => {
    if (!kiosk || !statsTabAutoRotate) {
      return;
    }
    const id = window.setInterval(() => {
      const cur = statisticsTabRef.current;
      setStatisticsTab(cur === "workshops" ? "registrations" : "workshops");
    }, pageRotationMs);
    return () => window.clearInterval(id);
  }, [kiosk, statsTabAutoRotate, pageRotationMs, setStatisticsTab]);

  const setTab = (t: StatisticsTab) => {
    setStatisticsTab(t);
  };

  const regEvents = registrations?.events ?? [];
  const { excursionEntries, workshopEntries } = useMemo(
    () => splitBookingHistoryEntries(visibleGroups),
    [visibleGroups]
  );
  const bookingHistoryPages = useMemo<Array<"excursions" | "workshops">>(() => {
    const p: Array<"excursions" | "workshops"> = [];
    if (excursionEntries.length > 0) {
      p.push("excursions");
    }
    if (workshopEntries.length > 0) {
      p.push("workshops");
    }
    return p;
  }, [excursionEntries, workshopEntries]);

  return (
    <div className="dashboard__statistics">
      <nav className="stat-tabs" aria-label="Statistik-Tabs">
        <button
          type="button"
          className={`stat-tabs__btn${statisticsTab === "workshops" ? " stat-tabs__btn--active" : ""}`}
          aria-pressed={statisticsTab === "workshops"}
          disabled={kiosk && displayConfig.statsTabAutoRotate}
          onClick={() => setTab("workshops")}
        >
          Begleitprogramm
        </button>
        <button
          type="button"
          className={`stat-tabs__btn${statisticsTab === "registrations" ? " stat-tabs__btn--active" : ""}`}
          aria-pressed={statisticsTab === "registrations"}
          disabled={kiosk && displayConfig.statsTabAutoRotate}
          onClick={() => setTab("registrations")}
        >
          Anmeldungen
        </button>
      </nav>

      {statsError !== null ? (
        <p className="dashboard__state dashboard__state--error" role="alert">
          {statsError}
        </p>
      ) : null}

      {statisticsTab === "workshops" ? (
        <div className="dashboard__statistics-body">
          {bookingHistoryPages.length === 0 ? (
            <p className="dashboard__state">Keine Einträge im Begleitprogramm zum Anzeigen.</p>
          ) : (
            <PaginatedTileGrid
              key={`hist-charts-${String(displayConfig.effectiveCols)}-${String(displayConfig.effectiveRows)}-${String(displayConfig.tilesPerPage)}-${displayConfig.groupRotationMode}`}
              items={bookingHistoryPages}
              itemKey={(k) => k}
              renderItem={(k) =>
                k === "excursions" ? (
                  <BookingHistoryChart
                    title="Exkursionen · gebuchte Plätze"
                    standIso={availabilityFetchedAt}
                    entries={excursionEntries}
                    kiosk={kiosk}
                    onOpenEntryDetail={onOpenEntryDetail}
                  />
                ) : (
                  <BookingHistoryChart
                    title="Workshops · gebuchte Plätze"
                    standIso={availabilityFetchedAt}
                    entries={workshopEntries}
                    kiosk={kiosk}
                    onOpenEntryDetail={onOpenEntryDetail}
                  />
                )
              }
              tilesPerPage={displayConfig.tilesPerPage}
              cols={displayConfig.effectiveCols}
              rows={displayConfig.effectiveRows}
              pageRotationMs={displayConfig.pageRotationMs}
              rotationMode={displayConfig.groupRotationMode}
              globalPageIndex={globalPageIndex}
              onGlobalPageSelect={
                displayConfig.groupRotationMode === "global" ? onGlobalPageSelect : undefined
              }
              wrapperClassName="dashboard__section stat-booking-history__section"
              ariaLabel="Begleitprogramm, gebuchte Plätze (Workshops und Exkursionen)"
            />
          )}
        </div>
      ) : (
        <div className="dashboard__statistics-body">
          {registrations === null && statsError === null ? (
            statsServerUnreachable ? (
              <p className="dashboard__state" role="status">
                Anmeldungsdaten sind derzeit nicht erreichbar.
              </p>
            ) : (
              <p className="dashboard__state" role="status">
                Aggregierte Registrierungen werden geladen …
              </p>
            )
          ) : null}
          {registrations !== null && regEvents.length === 0 ? (
            <p className="dashboard__state">Keine Anmeldedaten zum Anzeigen.</p>
          ) : null}
          {registrations !== null && regEvents.length > 0 ? (
            <div className="stat-registrations">
              <PaginatedTileGrid
                key={`reg-charts-${String(displayConfig.effectiveCols)}-${String(displayConfig.effectiveRows)}-${String(displayConfig.tilesPerPage)}-${displayConfig.groupRotationMode}`}
                items={REGISTRATIONS_CHART_PAGE_KEYS}
                itemKey={(k) => k}
                renderItem={(k) =>
                  k === "weekly" ? (
                    <RegistrationsWeeklyTile
                      events={regEvents}
                      emphasizedEventSlug={registrations.emphasizedEventSlug}
                      standIso={registrationsFetchedAt}
                    />
                  ) : (
                    <RegistrationsCumulativeTile
                      events={regEvents}
                      emphasizedEventSlug={registrations.emphasizedEventSlug}
                      standIso={registrationsFetchedAt}
                    />
                  )
                }
                tilesPerPage={displayConfig.tilesPerPage}
                cols={displayConfig.effectiveCols}
                rows={displayConfig.effectiveRows}
                pageRotationMs={displayConfig.pageRotationMs}
                rotationMode={displayConfig.groupRotationMode}
                globalPageIndex={globalPageIndex}
                onGlobalPageSelect={
                  displayConfig.groupRotationMode === "global" ? onGlobalPageSelect : undefined
                }
                headerSlot={
                  <RegistrationsLegend
                    events={regEvents}
                    emphasizedEventSlug={registrations.emphasizedEventSlug}
                  />
                }
                wrapperClassName="dashboard__section stat-registrations__section"
                ariaLabel="Anmeldungen, Mehrjahresdiagramme"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
