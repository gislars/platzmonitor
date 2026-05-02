import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { fetchAvailability, fetchRegistrations } from "../api";
import {
  isUnreachableApiErrorMessage,
  summarizeStatisticsFetchErrors,
} from "../apiErrors";
import { getRegistrationsPollIntervalMs } from "../config";
import { getKioskMode } from "../kiosk";
import { isEntryStartInFutureOrNow } from "../entryStartTime";
import { sortEntriesByDateTimeAsc } from "../sortEntries";
import type { AvailabilityResponse, Entry, RegistrationsResponse } from "../types";
import { useDisplayConfig } from "../useDisplayConfig";
import { BookingDetailDialog } from "./BookingDetailDialog";
import { ConfigPanel } from "./ConfigPanel";
import { GroupSection } from "./GroupSection";
import { StatisticsView } from "./StatisticsView";

export function Dashboard() {
  const displayConfig = useDisplayConfig();
  const [kiosk] = useState(getKioskMode);

  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<RegistrationsResponse | null>(null);
  const [statsRegistrationsError, setStatsRegistrationsError] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null);

  const [globalPageIndex, setGlobalPageIndex] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchAvailability();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), displayConfig.pollMs);
    return () => window.clearInterval(id);
  }, [load, displayConfig.pollMs]);

  const loadRegistrationsStats = useCallback(async () => {
    try {
      const r = await fetchRegistrations();
      setRegistrations(r);
      setStatsRegistrationsError(null);
    } catch (e) {
      setStatsRegistrationsError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }, []);

  useEffect(() => {
    if (displayConfig.viewMode !== "statistics") {
      return;
    }
    void loadRegistrationsStats();
    const id = window.setInterval(
      () => void loadRegistrationsStats(),
      getRegistrationsPollIntervalMs()
    );
    return () => window.clearInterval(id);
  }, [displayConfig.viewMode, loadRegistrationsStats]);

  const statsFetchSummary = useMemo(
    () => summarizeStatisticsFetchErrors(statsRegistrationsError),
    [statsRegistrationsError]
  );

  const hasEntries = data?.groups.some((g) => g.entries.length > 0) ?? false;

  const sortedGroups = useMemo(() => {
    if (!data?.groups) {
      return null;
    }
    return data.groups.map((g) => ({
      ...g,
      entries: sortEntriesByDateTimeAsc(g.entries),
    }));
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!sortedGroups) {
      return null;
    }

    const filterEntry = (e: Entry) => {
      if (displayConfig.hideSoldOutEntries && e.status === "sold_out") {
        return false;
      }
      if (displayConfig.hidePastEntries && !isEntryStartInFutureOrNow(e)) {
        return false;
      }
      return true;
    };

    return sortedGroups.map((g) => ({
      ...g,
      entries: g.entries.filter(filterEntry),
    }));
  }, [sortedGroups, displayConfig.hideSoldOutEntries, displayConfig.hidePastEntries]);

  const visibleGroups = useMemo(() => {
    if (!filteredGroups) {
      return [];
    }
    if (!displayConfig.hideEmptyGroups) {
      return filteredGroups;
    }
    return filteredGroups.filter((g) => g.entries.length > 0);
  }, [filteredGroups, displayConfig.hideEmptyGroups]);

  useEffect(() => {
    setGlobalPageIndex(0);
  }, [visibleGroups.length, displayConfig.groupRotationMode]);

  useEffect(() => {
    if (displayConfig.groupRotationMode !== "global") {
      return;
    }
    const id = window.setInterval(() => {
      setGlobalPageIndex((p) => p + 1);
    }, displayConfig.pageRotationMs);
    return () => window.clearInterval(id);
  }, [displayConfig.groupRotationMode, displayConfig.pageRotationMs]);

  const groupGridColumns = useMemo(() => {
    const n = visibleGroups.length;
    if (n === 0) {
      return 1;
    }
    return Math.min(n, displayConfig.maxGroupColumns);
  }, [visibleGroups.length, displayConfig.maxGroupColumns]);

  const availabilityFetchedAt = data?.fetchedAt;
  const registrationsFetchedAt = registrations?.fetchedAt;

  const availabilityUnreachable = error !== null && isUnreachableApiErrorMessage(error);

  const eventTitle = (data?.event.title?.trim() || "FOSSGIS").trim();

  const showConnectivityHint =
    availabilityUnreachable ||
    (displayConfig.viewMode === "statistics" && statsFetchSummary.showHeaderUnreachableHint);

  const rootClass = kiosk ? "dashboard dashboard--kiosk" : "dashboard";

  const groupsStyle = {
    gridTemplateColumns: `repeat(${groupGridColumns}, minmax(0, 1fr))`,
  } as const;

  return (
    <div className={rootClass}>
      <header className="dashboard__header">
        <div className="dashboard__header-lead" aria-hidden="true" />
        <div className="dashboard__header-center">
          <h1 className="dashboard__title">{eventTitle}</h1>
          <p className="dashboard__tagline">
            {displayConfig.viewMode === "tiles" ? "Freie Plätze" : "Statistik"}
          </p>
          {displayConfig.viewMode === "tiles" ? (
            <p
              className="dashboard__help"
              style={
                {
                  "--dashboard-help-rotation-ms": `${displayConfig.pageRotationMs}ms`,
                } as CSSProperties
              }
            >
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
              <span className="dashboard__help-text">Buchungen sind am Help-Desk möglich.</span>
            </p>
          ) : null}
          {showConnectivityHint ? (
            <p className="dashboard__sub" role="status">
              Keine Verbindung<span className="dashboard__sub-hint"> zum Server</span>
            </p>
          ) : null}
        </div>
        <div className="dashboard__header-actions">
          {!kiosk ? (
            <button type="button" className="dashboard__refresh" onClick={() => void load()}>
              Aktualisieren
            </button>
          ) : null}
        </div>
      </header>

      {loading && !data && (
        <p className="dashboard__state" role="status">
          Daten werden geladen …
        </p>
      )}

      {error !== null && !availabilityUnreachable && (
        <p className="dashboard__state dashboard__state--error" role="alert">
          {error}
        </p>
      )}

      {data && !hasEntries && !error && (
        <p className="dashboard__state">
          Keine passenden Angebote (Filter) oder keine freien Einträge.
        </p>
      )}

      {displayConfig.viewMode === "tiles" && visibleGroups.length > 0 ? (
        <div className="dashboard__groups" style={groupsStyle}>
          {visibleGroups.map((group) => (
            <GroupSection
              key={`${group.id}-${displayConfig.tilesPerPage}-${group.entries.length}-${displayConfig.groupRotationMode}`}
              availabilityFetchedAt={availabilityFetchedAt}
              group={group}
              tilesPerPage={displayConfig.tilesPerPage}
              cols={displayConfig.effectiveCols}
              rows={displayConfig.effectiveRows}
              pageRotationMs={displayConfig.pageRotationMs}
              rotationMode={displayConfig.groupRotationMode}
              globalPageIndex={globalPageIndex}
              onGlobalPageSelect={
                displayConfig.groupRotationMode === "global" ? setGlobalPageIndex : undefined
              }
            />
          ))}
        </div>
      ) : null}

      {displayConfig.viewMode === "statistics" ? (
        <StatisticsView
          displayConfig={displayConfig}
          kiosk={kiosk}
          availabilityFetchedAt={availabilityFetchedAt}
          registrationsFetchedAt={registrationsFetchedAt}
          visibleGroups={visibleGroups}
          registrations={registrations}
          statsError={statsFetchSummary.bannerMessage}
          statsServerUnreachable={statsFetchSummary.showHeaderUnreachableHint}
          globalPageIndex={globalPageIndex}
          onGlobalPageSelect={setGlobalPageIndex}
          onOpenEntryDetail={setDetailEntry}
        />
      ) : null}

      <BookingDetailDialog entry={detailEntry} onClose={() => setDetailEntry(null)} />

      {!kiosk ? <ConfigPanel config={displayConfig} /> : null}
    </div>
  );
}
