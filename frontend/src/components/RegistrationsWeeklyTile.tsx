import { useMemo } from "react";
import {
  formatRegistrationsWeeklyHoverCaption,
  formatRegistrationsCountDe,
  pointsThroughConferenceStart,
  registrationsChannelValue,
  type RegistrationsChannelMode,
} from "../registrationCharts";
import type { RegistrationsEventSerie } from "../types";
import { registrationsSeriesStrokeColor } from "../statisticsPalette";
import { ChartStandInline } from "./ChartStandInline";
import type { LineSeries } from "./LineChart";
import { LineChart } from "./LineChart";
import { useRegistrationsTileChartSetup } from "./registrationsCharts/useRegistrationsTileChartSetup";
import { RegistrationsChannelModePicker } from "./RegistrationsChannelModePicker";

type Props = {
  events: RegistrationsEventSerie[];
  emphasizedEventSlug: string;
  standIso?: string | null;
  /** Für Abdunkeln des jeweils anderen Anmeldungs-Diagramms beim Hover. */
  interactionChartKey?: string;
};

function parseDay(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function buildWeeklySeriesForMode(
  events: RegistrationsEventSerie[],
  emphasizedEventSlug: string,
  mode: RegistrationsChannelMode
): LineSeries[] {
  return events.map((ev, i) => {
    const color = registrationsSeriesStrokeColor(i, ev.slug === emphasizedEventSlug);
    const pts = pointsThroughConferenceStart([...ev.points]).sort(
      (a, b) => parseDay(a.date) - parseDay(b.date)
    );
    const bucket = new Map<number, number>();
    for (let j = 1; j < pts.length; j++) {
      const prevT = parseDay(pts[j - 1].date);
      const curT = parseDay(pts[j].date);
      if (!Number.isFinite(prevT) || !Number.isFinite(curT)) {
        continue;
      }
      const d =
        registrationsChannelValue(mode, pts[j]) - registrationsChannelValue(mode, pts[j - 1]);
      if (d <= 0) {
        continue;
      }
      const w = Math.round(pts[j].weeksBefore);
      const bw = Math.max(0, Math.min(52, w));
      bucket.set(bw, (bucket.get(bw) ?? 0) + d);
    }
    const keys = [...bucket.keys()].sort((a, b) => a - b);
    const chartPts = keys.map((k) => ({ x: k, y: bucket.get(k) ?? 0 }));
    return {
      id: `${ev.slug}-weekly-${mode}`,
      label: ev.label,
      emphasize: ev.slug === emphasizedEventSlug,
      color,
      points: chartPts,
    };
  });
}

const Y_LABEL: Record<RegistrationsChannelMode, string> = {
  online: "Pro Woche (Online)",
  onsite: "Pro Woche (vor Ort)",
  total: "Pro Woche (Summe)",
};

export function RegistrationsWeeklyTile({
  events,
  emphasizedEventSlug,
  standIso,
  interactionChartKey,
}: Props) {
  const { chartW, onPlotHoverChange, peerDimmed, onsitePossible, chartMode, setMode } =
    useRegistrationsTileChartSetup(events, interactionChartKey);

  const series = useMemo(
    () => buildWeeklySeriesForMode(events, emphasizedEventSlug, chartMode),
    [events, emphasizedEventSlug, chartMode]
  );
  const hasData = series.some((s) => s.points.length > 0);

  return (
    <section
      className={`stat-reg-chart${peerDimmed ? " stat-reg-chart--peer-dimmed" : ""}`}
      aria-labelledby="stat-reg-week-title"
    >
      <div className="stat-reg-chart__head">
        <h3 id="stat-reg-week-title" className="stat-reg-chart__title">
          FOSSGIS Anmeldungen pro Woche
          {" "}
          <ChartStandInline iso={standIso} />
        </h3>
        <RegistrationsChannelModePicker
          mode={chartMode}
          onChange={setMode}
          onsitePossible={onsitePossible}
          ariaLabel="Kanal nach Woche"
        />
      </div>
      {hasData ? (
        <LineChart
          key={chartMode}
          series={series}
          width={chartW}
          height={300}
          xLabel="Wochen vor Konferenzbeginn"
          yLabel={Y_LABEL[chartMode]}
          invertX
          formatXTick={(w) => String(Math.round(w))}
          formatY={formatRegistrationsCountDe}
          formatHoverBody={(weeks, val) => formatRegistrationsWeeklyHoverCaption(weeks, val)}
          onPlotHoverChange={interactionChartKey !== undefined ? onPlotHoverChange : undefined}
          hoverSnapToNearestX
          selectableSeries={series.length > 1}
        />
      ) : (
        <p className="stat-reg-chart__empty">
          {chartMode === "onsite"
            ? "Keine vor-Ort-Verlaufsdaten für Zuordnung."
            : "Keine auswertbaren Wochen-Zuwächse."}
        </p>
      )}
    </section>
  );
}
