import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Entry, Group, RegistrationsResponse } from "../types";
import { splitBookingHistoryEntries } from "../statisticsBookingSplit";
import type { DisplayConfigState } from "../useDisplayConfig";
import { BookingHistoryChart } from "./BookingHistoryChart";
import { PaginatedTileGrid } from "./PaginatedTileGrid";
import { RegistrationsCumulativeTile } from "./RegistrationsCumulativeTile";
import { RegistrationsLegend } from "./RegistrationsLegend";
import { RegistrationsWeeklyTile } from "./RegistrationsWeeklyTile";

const REGISTRATIONS_CHART_PAGE_KEYS: ("weekly" | "cumulative")[] = ["weekly", "cumulative"];

type Props = {
  displayConfig: DisplayConfigState;
  kiosk: boolean;
  event: string;
  /** Zeitstempel der Verfügbarkeitsdaten (pretix) für Balkendiagramme. */
  availabilityFetchedAt?: string | null;
  /** Zeitstempel der Registrierungsaggregation für Anmeldungsdiagramme. */
  registrationsFetchedAt?: string | null;
  visibleGroups: Group[];
  registrations: RegistrationsResponse | null;
  statsError: string | null;
  /** Statistik-APIs nicht erreichbar: Hinweis im Kopfbereich. */
  statsServerUnreachable?: boolean;
  globalPageIndex: number;
  onGlobalPageSelect: (index: number) => void;
  onOpenEntryDetail?: (entry: Entry) => void;
};

export function StatisticsView({
  displayConfig,
  kiosk,
  event,
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
  const { domain, statsTabAutoRotate, pageRotationMs, setDomain } = displayConfig;

  const domainRef = useRef(domain);
  useLayoutEffect(() => {
    domainRef.current = domain;
  }, [domain]);

  useEffect(() => {
    if (!kiosk || !statsTabAutoRotate) {
      return;
    }
    const id = window.setInterval(() => {
      const cur = domainRef.current;
      setDomain(cur === "begleitprogramm" ? "anmeldungen" : "begleitprogramm");
    }, pageRotationMs);
    return () => window.clearInterval(id);
  }, [kiosk, statsTabAutoRotate, pageRotationMs, setDomain]);

  const regEvents = registrations?.events ?? [];
  const { excursionEntries, workshopEntries } = useMemo(
    () => splitBookingHistoryEntries(visibleGroups),
    [visibleGroups]
  );
  const bookingHistoryPages = useMemo<Array<"exkursionen" | "workshops">>(() => {
    const p: Array<"exkursionen" | "workshops"> = [];
    if (excursionEntries.length > 0) {
      p.push("exkursionen");
    }
    if (workshopEntries.length > 0) {
      p.push("workshops");
    }
    return p;
  }, [excursionEntries, workshopEntries]);

  return (
    <>
      {statsError !== null ? (
        <p className="dashboard__state dashboard__state--error" role="alert">
          {statsError}
        </p>
      ) : null}

      {domain === "begleitprogramm" ? (
        <div className="dashboard__statistics-body">
          {bookingHistoryPages.length === 0 ? (
            <p className="dashboard__state">Keine Einträge im Begleitprogramm zum Anzeigen.</p>
          ) : (
            <PaginatedTileGrid
              key={`hist-charts-${String(displayConfig.effectiveCols)}-${String(displayConfig.effectiveRows)}-${String(displayConfig.tilesPerPage)}-${displayConfig.groupRotationMode}`}
              items={bookingHistoryPages}
              itemKey={(k) => k}
              renderItem={(k) =>
                k === "exkursionen" ? (
                  <BookingHistoryChart
                    title="Kategorie Exkursionen · gebuchte Plätze"
                    standIso={availabilityFetchedAt}
                    entries={excursionEntries}
                    kiosk={kiosk}
                    event={event}
                    exportEmbedChart="booking-excursions"
                    onOpenEntryDetail={onOpenEntryDetail}
                  />
                ) : (
                  <BookingHistoryChart
                    title="Kategorie Workshops · gebuchte Plätze"
                    standIso={availabilityFetchedAt}
                    entries={workshopEntries}
                    kiosk={kiosk}
                    event={event}
                    exportEmbedChart="booking-workshops"
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
                      kiosk={kiosk}
                    />
                  ) : (
                    <RegistrationsCumulativeTile
                      events={regEvents}
                      emphasizedEventSlug={registrations.emphasizedEventSlug}
                      standIso={registrationsFetchedAt}
                      kiosk={kiosk}
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
    </>
  );
}
