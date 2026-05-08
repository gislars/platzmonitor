import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAvailabilityForEvent, fetchRegistrationsForEvent } from "../api";
import { parseEmbedChartQuery } from "../chartEmbed";
import { getPollIntervalMs } from "../config";
import { splitBookingHistoryEntries } from "../statisticsBookingSplit";
import { useChartWidth } from "../useChartWidth";
import {
  BOOKING_QUOTA_TIMELINE_EMPTY_MESSAGE,
  formatBookingQuotaTimelineAxisDate,
  formatBookingQuotaTimelineHover,
  useBookingQuotaTimeline,
} from "../useBookingQuotaTimeline";
import type { AvailabilityResponse, Entry, RegistrationsResponse } from "../types";
import { BookingHistoryChart } from "./BookingHistoryChart";
import { LineChart } from "./LineChart";
import { RegistrationsCumulativeTile } from "./RegistrationsCumulativeTile";
import { RegistrationsWeeklyTile } from "./RegistrationsWeeklyTile";

/** Hinweis, wenn nach gelungenem Laden die Aktualisierung vom Server fehlschlägt (Embed zeigt letzten Stand). */
const EMBED_SERVER_UNAVAILABLE_STALE =
  "Es besteht derzeit keine Verbindung zum Server. Die angezeigten Daten können veraltet sein.";

/** Hinweis, wenn beim ersten Laden keine Daten geholt werden konnten. */
const EMBED_SERVER_UNAVAILABLE_NO_DATA =
  "Es besteht derzeit keine Verbindung zum Server. Die Daten konnten nicht geladen werden.";

function EmbedOfflineStaleNotice() {
  return (
    <p className="embed-page__offline-notice" role="status" aria-live="polite">
      {EMBED_SERVER_UNAVAILABLE_STALE}
    </p>
  );
}

function EmbedOfflineNoDataNotice() {
  return (
    <div className="embed-page">
      <p className="embed-page__offline-notice" role="status">
        {EMBED_SERVER_UNAVAILABLE_NO_DATA}
      </p>
    </div>
  );
}

function readEmbedParams(): {
  chart: string | null;
  quotaId: string | null;
  event: string | null;
  include: string | null;
} {
  const u = new URL(window.location.href);
  return {
    chart: u.searchParams.get("chart"),
    quotaId: u.searchParams.get("quotaId"),
    event: u.searchParams.get("event"),
    include: u.searchParams.get("include"),
  };
}

function findEntryByQuotaId(data: AvailabilityResponse, quotaId: string): Entry | null {
  for (const g of data.groups) {
    for (const e of g.entries) {
      if (e.id === quotaId) {
        return e;
      }
    }
  }
  return null;
}

function EmbedBookingDetailChart({ entry, event }: { entry: Entry; event: string }) {
  const chartW = useChartWidth(720, 48);
  const { loading, loadError, fetchedAt, bookedSeries, hasChartCurve, bookedLineIsFlat } =
    useBookingQuotaTimeline(entry, { event });

  const showTimelineOnlyOffline =
    !loading && loadError !== null;

  return (
    <div className="embed-page__panel">
      {!showTimelineOnlyOffline ? (
        <h1 className="embed-page__title">{entry.label}</h1>
      ) : null}
      {loadError !== null ? (
        <p className="embed-page__offline-notice" role="status">
          {EMBED_SERVER_UNAVAILABLE_NO_DATA}
        </p>
      ) : null}
      {loading ? (
        <p className="dashboard__state" role="status">
          Transaktionsverlauf wird geladen …
        </p>
      ) : null}
      {!loading && loadError === null && hasChartCurve && bookedLineIsFlat ? (
        <p className="stat-dialog__notice" role="note">
          Waagerechte Linie: In den ausgewerteten Tagen hat sich der kumulative Nettowert aus den
          Transaktionen nicht geändert (oder es gibt nur sehr wenige Tage mit Meldungen).
        </p>
      ) : null}
      <div className="embed-page__chart">
        {!loading && loadError === null ? (
          hasChartCurve ? (
            <LineChart
              series={bookedSeries}
              width={chartW}
              height={280}
              xLabel="Datum"
              yLabel="Gebuchte Plätze"
              formatX={formatBookingQuotaTimelineAxisDate}
              formatHoverBody={formatBookingQuotaTimelineHover}
            />
          ) : (
            <p className="stat-reg-chart__empty">{BOOKING_QUOTA_TIMELINE_EMPTY_MESSAGE}</p>
          )
        ) : null}
      </div>
      {fetchedAt !== null ? (
        <p className="embed-page__meta">
          Stand Timeline: {new Date(fetchedAt).toLocaleString("de-DE")}
        </p>
      ) : null}
    </div>
  );
}

export function EmbedPage() {
  const { chart: chartRaw, quotaId, event, include } = useMemo(() => readEmbedParams(), []);
  const chart = parseEmbedChartQuery(chartRaw);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<RegistrationsResponse | null>(null);
  const [registrationsError, setRegistrationsError] = useState<string | null>(null);

  const loadAvailability = useCallback(async () => {
    try {
      const ev = (event ?? "").trim();
      const res = await fetchAvailabilityForEvent(ev);
      setAvailability(res);
      setAvailabilityError(null);
    } catch (e) {
      setAvailabilityError(e instanceof Error ? e.message : String(e));
    }
  }, [event]);

  const loadRegistrations = useCallback(async () => {
    try {
      const ev = (event ?? "").trim();
      const r = await fetchRegistrationsForEvent(ev, {
        include: (include ?? "").trim() || undefined,
      });
      setRegistrations(r);
      setRegistrationsError(null);
    } catch (e) {
      setRegistrationsError(e instanceof Error ? e.message : String(e));
    }
  }, [event, include]);

  useEffect(() => {
    if (
      chart === "booking-excursions" ||
      chart === "booking-workshops" ||
      chart === "booking-detail"
    ) {
      const kick = window.setTimeout(() => void loadAvailability(), 0);
      const id = window.setInterval(() => void loadAvailability(), getPollIntervalMs());
      return () => {
        window.clearTimeout(kick);
        window.clearInterval(id);
      };
    }
    return undefined;
  }, [chart, loadAvailability]);

  useEffect(() => {
    if (chart === "reg-weekly" || chart === "reg-cumulative") {
      // Embeds: festes Poll-Intervall wie booking-*, nicht displayConfig.pollMs.
      const pollMs = getPollIntervalMs();
      const kick = window.setTimeout(() => void loadRegistrations(), 0);
      const id = window.setInterval(() => void loadRegistrations(), pollMs);
      return () => {
        window.clearTimeout(kick);
        window.clearInterval(id);
      };
    }
    return undefined;
  }, [chart, loadRegistrations]);

  const { excursionEntries, workshopEntries } = useMemo(
    () => splitBookingHistoryEntries(availability?.groups ?? []),
    [availability?.groups]
  );

  const bookingPollOffline = availability !== null && availabilityError !== null;
  const registrationsPollOffline = registrations !== null && registrationsError !== null;

  if (chart === null) {
    return (
      <div className="embed-page">
        <p className="dashboard__state dashboard__state--error" role="alert">
          Ungültiger oder fehlender Parameter <code>chart</code>. Erlaubt sind: booking-excursions,
          booking-workshops, reg-weekly, reg-cumulative, booking-detail (mit{" "}
          <code>quotaId</code>).
        </p>
      </div>
    );
  }

  if (!event || event.trim() === "") {
    return (
      <div className="embed-page">
        <p className="dashboard__state dashboard__state--error" role="alert">
          Fehlender Query-Parameter <code>event</code>. Bitte das Widget neu einbetten und{" "}
          <code>data-event</code> setzen.
        </p>
      </div>
    );
  }

  if (chart === "booking-detail" && (!quotaId || quotaId.trim() === "")) {
    return (
      <div className="embed-page">
        <p className="dashboard__state dashboard__state--error" role="alert">
          Für <code>chart=booking-detail</code> ist der Query-Parameter <code>quotaId</code>{" "}
          erforderlich.
        </p>
      </div>
    );
  }

  if (
    chart === "booking-excursions" ||
    chart === "booking-workshops" ||
    chart === "booking-detail"
  ) {
    if (availability === null && availabilityError !== null) {
      return <EmbedOfflineNoDataNotice />;
    }
    if (availability === null) {
      return (
        <div className="embed-page">
          <p className="dashboard__state" role="status">
            Daten werden geladen …
          </p>
        </div>
      );
    }
    if (chart === "booking-excursions") {
      return (
        <div className="embed-page">
          {bookingPollOffline ? <EmbedOfflineStaleNotice /> : null}
          {excursionEntries.length === 0 ? (
            <p className="dashboard__state">Keine Exkursionseinträge.</p>
          ) : (
            <BookingHistoryChart
              title="Exkursionen · gebuchte Plätze"
              standIso={availability.fetchedAt}
              entries={excursionEntries}
              kiosk
              event={event}
            />
          )}
        </div>
      );
    }
    if (chart === "booking-workshops") {
      return (
        <div className="embed-page">
          {bookingPollOffline ? <EmbedOfflineStaleNotice /> : null}
          {workshopEntries.length === 0 ? (
            <p className="dashboard__state">Keine Workshop-Einträge.</p>
          ) : (
            <BookingHistoryChart
              title="Workshops · gebuchte Plätze"
              standIso={availability.fetchedAt}
              entries={workshopEntries}
              kiosk
              event={event}
            />
          )}
        </div>
      );
    }
    const entry = findEntryByQuotaId(availability, quotaId ?? "");
    if (entry === null) {
      return (
        <div className="embed-page">
          <p className="dashboard__state dashboard__state--error" role="alert">
            Kein Angebot mit dieser <code>quotaId</code> in den aktuellen Daten.
          </p>
        </div>
      );
    }
    return (
      <div className="embed-page">
        {bookingPollOffline ? <EmbedOfflineStaleNotice /> : null}
        <EmbedBookingDetailChart key={entry.id} entry={entry} event={event} />
      </div>
    );
  }

  if (chart === "reg-weekly" || chart === "reg-cumulative") {
    if (registrations === null && registrationsError !== null) {
      return <EmbedOfflineNoDataNotice />;
    }
    if (registrations === null) {
      return (
        <div className="embed-page">
          <p className="dashboard__state" role="status">
            Registrierungsdaten werden geladen …
          </p>
        </div>
      );
    }
    if (registrations.events.length === 0) {
      return (
        <div className="embed-page">
          <p className="dashboard__state">Noch keine Jahresdaten.</p>
        </div>
      );
    }
    return (
      <div className="embed-page embed-page--registration">
        {registrationsPollOffline ? <EmbedOfflineStaleNotice /> : null}
        {chart === "reg-weekly" ? (
          <RegistrationsWeeklyTile
            events={registrations.events}
            emphasizedEventSlug={registrations.emphasizedEventSlug}
            standIso={registrations.fetchedAt}
            showChartExportMenu={false}
            compactForEmbed
          />
        ) : (
          <RegistrationsCumulativeTile
            events={registrations.events}
            emphasizedEventSlug={registrations.emphasizedEventSlug}
            standIso={registrations.fetchedAt}
            showChartExportMenu={false}
            compactForEmbed
          />
        )}
      </div>
    );
  }

  throw new Error("EmbedPage: unerwarteter chart-Wert");
}
