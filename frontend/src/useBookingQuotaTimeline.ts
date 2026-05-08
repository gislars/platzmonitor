import { useEffect, useMemo, useState } from "react";
import { fetchBookingTimeline } from "./api";
import { sortHistoryPointsAsc } from "./historyPoints";
import { areLinePointsYsFlat } from "./lineChartHelpers";
import { chartEmphasisColor } from "./statisticsPalette";
import type { Entry, HistoryPoint } from "./types";
import type { LineSeries } from "./components/LineChart";

/** Einheitlicher Hinweis, wenn keine ausreichende Transaktions-Zeitreihe vorliegt (Dialog und Embed). */
export const BOOKING_QUOTA_TIMELINE_EMPTY_MESSAGE =
  "Für diese Quota liegen keine oder zu wenige Transaktionspunkte in der Datenbank (noch nicht berechnet oder keine passenden Buchungen gefunden).";

export function formatBookingQuotaTimelineAxisDate(tSeconds: number): string {
  return new Date(Math.round(tSeconds) * 1000).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatBookingQuotaTimelineHover(tSec: number, y: number): string {
  return `${formatBookingQuotaTimelineAxisDate(tSec)} · kumuliert ${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(y)}`;
}

export function useBookingQuotaTimeline(
  entry: Entry,
  opts?: { event?: string }
): {
  loading: boolean;
  loadError: string | null;
  fetchedAt: string | null;
  bookedSeries: LineSeries[];
  hasChartCurve: boolean;
  bookedLineIsFlat: boolean;
} {
  const [timelinePoints, setTimelinePoints] = useState<HistoryPoint[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const quotaId = entry.id;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || ac.signal.aborted) {
        return;
      }
      setLoading(true);
      setLoadError(null);
      setTimelinePoints([]);
      setFetchedAt(null);
      void fetchBookingTimeline(quotaId, { event: opts?.event, signal: ac.signal })
        .then((res) => {
          if (ac.signal.aborted) {
            return;
          }
          setFetchedAt(res.fetchedAt);
          const ser = res.series.find((s) => s.quotaId === quotaId);
          const pts =
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
          setFetchedAt(null);
          setTimelinePoints([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) {
            setLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [entry.id, opts?.event]);

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
  /** Eine Stützstelle reicht (z. B. alle Buchungen an einem Tag); für eine sichtbare Linie braucht es oft zwei Tage. */
  const hasChartCurve = bookedPts.length >= 1;
  const bookedLineIsFlat = areLinePointsYsFlat(bookedPts);

  return {
    loading,
    loadError,
    fetchedAt,
    bookedSeries,
    hasChartCurve,
    bookedLineIsFlat,
  };
}
