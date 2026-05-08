import { useEffect, useRef } from "react";
import type { Entry } from "../types";
import { useChartWidth } from "../useChartWidth";
import {
  BOOKING_QUOTA_TIMELINE_EMPTY_MESSAGE,
  formatBookingQuotaTimelineAxisDate,
  formatBookingQuotaTimelineHover,
  useBookingQuotaTimeline,
} from "../useBookingQuotaTimeline";
import { ChartExportMenu } from "./ChartExportMenu";
import { ChartStandInline } from "./ChartStandInline";
import { LineChart } from "./LineChart";

type Props = {
  entry: Entry | null;
  event: string;
  onClose: () => void;
};

type LoadedProps = {
  entry: Entry;
  event: string;
  onClose: () => void;
};

function BookingDetailDialogLoaded({ entry, event, onClose }: LoadedProps) {
  const chartW = useChartWidth(720, 48);
  const refDialog = useRef<HTMLDivElement | null>(null);
  const { loading, loadError, fetchedAt, bookedSeries, hasChartCurve, bookedLineIsFlat } =
    useBookingQuotaTimeline(entry, { event });
  const exportMenuDisabled = loading || loadError !== null || !hasChartCurve;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    refDialog.current?.focus();
  }, []);

  return (
    <div className="stat-dialog__root" role="presentation">
      <button
        type="button"
        className="stat-dialog__backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        ref={refDialog}
        className="stat-dialog chart-capture-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stat-dialog-title"
        tabIndex={-1}
      >
        <header className="stat-dialog__head">
          <h2 id="stat-dialog-title" className="stat-dialog__title">
            {entry.label}
            {" "}
            <ChartStandInline iso={!loading && loadError === null ? fetchedAt : null} />
          </h2>
          <div className="stat-dialog__head-actions">
            <ChartExportMenu
              captureRef={refDialog}
              fileNameBase={`Transaktionen-${entry.label}`}
              embedChart="booking-detail"
              event={event}
              embedQuotaId={entry.id}
              disabled={exportMenuDisabled}
            />
            <button type="button" className="stat-dialog__close chart-png-exclude" onClick={onClose}>
              Schließen
            </button>
          </div>
        </header>
        {loadError !== null ? (
          <p className="dashboard__state dashboard__state--error" role="alert">
            Timeline: {loadError}
          </p>
        ) : null}
        {loading ? (
          <p className="dashboard__state" role="status">
            Transaktionsverlauf wird geladen …
          </p>
        ) : null}
        {!loading && loadError === null && hasChartCurve && bookedLineIsFlat ? (
          <p className="stat-dialog__notice" role="note">
            Waagerechte Linie: In den ausgewerteten Tagen hat sich der kumulative Nettowert aus den Transaktionen nicht
            geändert (oder es gibt nur sehr wenige Tage mit Meldungen).
          </p>
        ) : null}
        <div className="stat-dialog__chart">
          {!loading && loadError === null ? (
            hasChartCurve ? (
              <LineChart
                series={bookedSeries}
                width={chartW}
                height={320}
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
      </div>
    </div>
  );
}

export function BookingDetailDialog({ entry, event, onClose }: Props) {
  if (entry === null) {
    return null;
  }

  return <BookingDetailDialogLoaded key={entry.id} entry={entry} event={event} onClose={onClose} />;
}
