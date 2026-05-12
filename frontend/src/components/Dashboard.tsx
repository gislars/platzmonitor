import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchAvailabilityForEvent, fetchRegistrationsForEvent } from "../api";
import {
  isUnreachableApiErrorMessage,
  summarizeStatisticsFetchErrors,
} from "../apiErrors";
import { getRegistrationsPollIntervalMs, type Domain } from "../config";
import { getKioskMode } from "../kiosk";
import { isEntryStartInFutureOrNow } from "../entryStartTime";
import { sortEntriesByDateTimeAsc } from "../sortEntries";
import type { AvailabilityResponse, Entry, RegistrationsResponse } from "../types";
import { useDisplayConfig } from "../useDisplayConfig";
import { BookingDetailDialog } from "./BookingDetailDialog";
import { ConfigPanel } from "./ConfigPanel";
import { DashboardMasthead } from "./DashboardMasthead";
import { GroupSection } from "./GroupSection";
import { StatSubTabsNav } from "./StatSubTabsNav";
import { StatisticsView } from "./StatisticsView";

/** Sweep-Schicht (echtes DOM, kein ::after): eine Iteration = pollMs, Start = Aufruf load(). */
function resetHelpSweepAnimation(layerEl: HTMLElement | null): void {
  if (!layerEl?.getAnimations) {
    return;
  }
  const apply = (): void => {
    try {
      for (const anim of layerEl.getAnimations()) {
        anim.currentTime = 0;
      }
    } catch {
      /* getAnimations optional in alten Engines */
    }
  };
  apply();
  requestAnimationFrame(apply);
}

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

  const helpSweepRef = useRef<HTMLSpanElement | null>(null);

  const load = useCallback(async () => {
    const ev = (displayConfig.eventSlug || "").trim();
    if (!ev) {
      // Jahr noch nicht bestimmt (Events-Katalog wird erst geladen).
      return;
    }
    resetHelpSweepAnimation(helpSweepRef.current);
    try {
      const res = await fetchAvailabilityForEvent(ev);
      setError(null);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [displayConfig.eventSlug]);

  useEffect(() => {
    const ev = (displayConfig.eventSlug || "").trim();
    if (!ev) {
      return;
    }
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), displayConfig.pollMs);
    return () => window.clearInterval(id);
  }, [displayConfig.eventSlug, load, displayConfig.pollMs]);

  const loadRegistrationsStats = useCallback(async () => {
    const ev = (displayConfig.eventSlug || "").trim();
    if (!ev) {
      return;
    }
    try {
      const r = await fetchRegistrationsForEvent(ev, {
        include: displayConfig.registrationsIncludePrevious ? "previous" : undefined,
      });
      setRegistrations(r);
      setStatsRegistrationsError(null);
    } catch (e) {
      setStatsRegistrationsError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }, [displayConfig.eventSlug, displayConfig.registrationsIncludePrevious]);

  useEffect(() => {
    if (displayConfig.view !== "analysen") {
      return;
    }
    void loadRegistrationsStats();
    const pollMs =
      statsRegistrationsError !== null ? displayConfig.pollMs : getRegistrationsPollIntervalMs();
    const id = window.setInterval(() => void loadRegistrationsStats(), pollMs);
    return () => window.clearInterval(id);
  }, [
    displayConfig.pollMs,
    displayConfig.view,
    loadRegistrationsStats,
    statsRegistrationsError,
  ]);

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
    (displayConfig.view === "analysen" && statsFetchSummary.showHeaderUnreachableHint);

  const rootClass = kiosk ? "dashboard dashboard--kiosk" : "dashboard";

  // Wenn die Verfuegbarkeits-API wieder erreichbar ist, aber die Registrierungen wegen
  // vorherigem Offline-Fehler noch als "nicht erreichbar" markiert sind, dann einmal
  // sofort nachladen statt bis zum (ggf. sehr langen) Registrierungs-Poll zu warten.
  useEffect(() => {
    if (displayConfig.view !== "analysen") {
      return;
    }
    if (availabilityUnreachable) {
      return;
    }
    if (!statsFetchSummary.showHeaderUnreachableHint) {
      return;
    }
    void loadRegistrationsStats();
  }, [
    availabilityUnreachable,
    displayConfig.view,
    loadRegistrationsStats,
    statsFetchSummary.showHeaderUnreachableHint,
  ]);

  const groupsStyle = {
    gridTemplateColumns: `repeat(${groupGridColumns}, minmax(0, 1fr))`,
  } as const;

  const tagline = displayConfig.view === "uebersicht" ? "Übersicht" : "Analysen";

  // Bereich-Navigation (Begleitprogramm / Anmeldungen) nur in Analysen anzeigen.
  // In Übersicht gibt es aktuell keine Bereich-Auswahl, daher keine Tabs.
  const showStatShell = displayConfig.view === "analysen";

  const view = displayConfig.view;
  const setView = displayConfig.setView;
  const setDomain = displayConfig.setDomain;

  const selectDomain = useCallback(
    (d: Domain) => {
      if (view === "uebersicht") {
        setView("analysen");
      }
      setDomain(d);
    },
    [view, setView, setDomain]
  );

  const statTabButtonsDisabled =
    kiosk &&
    displayConfig.statsTabAutoRotate &&
    displayConfig.view === "analysen";

  const helpBubbleText = useMemo(
    () =>
      displayConfig.view === "uebersicht"
        ? displayConfig.helpBubbleTiles
        : displayConfig.helpBubbleStatistics,
    [displayConfig.view, displayConfig.helpBubbleTiles, displayConfig.helpBubbleStatistics]
  );

  return (
    <div className={rootClass}>
      <DashboardMasthead
        eventTitle={eventTitle}
        tagline={tagline}
        helpText={helpBubbleText}
        pollMs={displayConfig.pollMs}
        kiosk={kiosk}
        onRefresh={() => void load()}
        showConnectivityHint={showConnectivityHint}
        helpSweepRef={helpSweepRef}
      />

      {showStatShell ? (
        <div className="dashboard__statistics">
          <StatSubTabsNav
            activeDomain={displayConfig.domain}
            onSelectDomain={selectDomain}
            disabled={statTabButtonsDisabled}
          />
          {displayConfig.view === "analysen" ? (
            <StatisticsView
              displayConfig={displayConfig}
              kiosk={kiosk}
              event={
                displayConfig.eventSlug && displayConfig.eventSlug.trim()
                  ? displayConfig.eventSlug.trim()
                  : data?.event.slug ?? ""
              }
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
        </div>
      ) : null}

      {loading && !data && (
        <p className="dashboard__state" role="status">
          {(displayConfig.eventSlug || "").trim()
            ? "Daten werden geladen …"
            : "Jahr wird geladen …"}
        </p>
      )}

      {!loading && !data && !(displayConfig.eventSlug || "").trim() ? (
        <p className="dashboard__state dashboard__state--error" role="alert">
          Kein Jahr konfiguriert. Bitte in den Einstellungen ein Jahr waehlen oder im Backend{" "}
          <code>EVENTS_JSON</code> setzen.
        </p>
      ) : null}

      {error !== null && !availabilityUnreachable && (
        <p className="dashboard__state dashboard__state--error" role="alert">
          {error}
        </p>
      )}

      {displayConfig.view === "uebersicht" && data && !hasEntries && !error && (
        <p className="dashboard__state">
          Keine passenden Angebote (Filter) oder keine freien Einträge.
        </p>
      )}

      {displayConfig.view === "uebersicht" && visibleGroups.length > 0 ? (
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

      <BookingDetailDialog
        entry={detailEntry}
        event={
          displayConfig.eventSlug && displayConfig.eventSlug.trim()
            ? displayConfig.eventSlug.trim()
            : data?.event.slug ?? ""
        }
        onClose={() => setDetailEntry(null)}
      />

      {!kiosk ? <ConfigPanel config={displayConfig} /> : null}
    </div>
  );
}
