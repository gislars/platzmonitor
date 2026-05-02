import { useEffect, useMemo, useRef, useState } from "react";
import { fetchBookingTimeline } from "../api";
import { sortHistoryPointsAsc } from "../historyPoints";
import { chartEmphasisColor } from "../statisticsPalette";
import { useChartWidth } from "../useChartWidth";
import type { Entry, HistoryPoint } from "../types";
import { ChartStandInline } from "./ChartStandInline";
import type { LineSeries } from "./LineChart";
import { LineChart } from "./LineChart";

function isFlatYs(points: readonly { x: number; y: number }[]): boolean {
  if (points.length < 2) {
    return false;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    lo = Math.min(lo, p.y);
    hi = Math.max(hi, p.y);
  }
  return !(hi > lo && hi - lo > 1e-6);
}

type Props = {
  entry: Entry | null;
  onClose: () => void;
};

type LoadedProps = {
  entry: Entry;
  onClose: () => void;
};

function BookingDetailDialogLoaded({ entry, onClose }: LoadedProps) {
  const chartW = useChartWidth(720, 48);
  const refDialog = useRef<HTMLDivElement | null>(null);
  const [timelinePoints, setTimelinePoints] = useState<HistoryPoint[]>([]);
  const [timelineFetchedAt, setTimelineFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void fetchBookingTimeline(entry.id, { signal: ac.signal })
      .then((res) => {
        setTimelineFetchedAt(res.fetchedAt);
        const ser = res.series.find((s) => s.quotaId === entry.id);
        const pts: HistoryPoint[] =
          ser?.points.map((p) => ({
            t: p.t,
            booked: p.booked,
          })) ?? [];
        setTimelinePoints(pts);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) {
          return;
        }
        setLoadError(e instanceof Error ? e.message : String(e));
        setTimelineFetchedAt(null);
        setTimelinePoints([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoading(false);
        }
      });
    return () => ac.abort();
  }, [entry]);

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

  const bookedSeries: LineSeries[] = useMemo(() => {
    const sorted = sortHistoryPointsAsc(timelinePoints)
      .filter((p) => p.booked != null)
      .map((p) => ({ x: p.t, y: p.booked ?? 0 }));

    return [
      {
        id: "booked",
        label: "Kumulativ gebucht (Transaktionen)",
        emphasize: true,
        color: chartEmphasisColor(),
        points: sorted,
      },
    ];
  }, [timelinePoints]);

  const bookedPts = bookedSeries[0]?.points ?? [];
  const hasChartCurve = bookedPts.length > 1;
  const bookedLineIsFlat = isFlatYs(bookedPts);

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
        className="stat-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stat-dialog-title"
        tabIndex={-1}
      >
        <header className="stat-dialog__head">
          <h2 id="stat-dialog-title" className="stat-dialog__title">
            {entry.label}
            {" "}
            <ChartStandInline iso={!loading && loadError === null ? timelineFetchedAt : null} />
          </h2>
          <button type="button" className="stat-dialog__close" onClick={onClose}>
            Schließen
          </button>
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
                yLabel="Kumulativ gebucht"
                formatX={(tSeconds) =>
                  new Date(Math.round(tSeconds) * 1000).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                }
                formatHoverBody={(tSec, y) =>
                  `${new Date(Math.round(tSec) * 1000).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })} · kumuliert ${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(y)}`
                }
              />
            ) : (
              <p>
                Für diese Quota liegen keine oder zu wenige Transaktionspunkte in der Datenbank (noch nicht berechnet
                oder keine passenden Buchungen gefunden).
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function BookingDetailDialog({ entry, onClose }: Props) {
  if (entry === null) {
    return null;
  }

  return <BookingDetailDialogLoaded key={entry.id} entry={entry} onClose={onClose} />;
}
