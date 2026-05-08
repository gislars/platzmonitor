import { useMemo, useRef, type CSSProperties } from "react";
import type { EmbedChartQuery } from "../chartEmbed";
import {
  formatRegistrationsWeeklyHoverCaption,
  formatRegistrationsCountDe,
  pointsThroughConferenceStart,
  registrationsChannelValue,
  registrationsYAxisLabel,
  type RegistrationsChannelMode,
} from "../registrationCharts";
import type { RegistrationsEventSerie } from "../types";
import { registrationsSeriesStrokeColor } from "../statisticsPalette";
import { ChartExportMenu } from "./ChartExportMenu";
import { ChartStandInline } from "./ChartStandInline";
import type { LineSeries } from "./LineChart";
import { LineChart } from "./LineChart";
import {
  REGISTRATIONS_LINE_CHART_PAD_R,
  useRegistrationsTileChartSetup,
} from "./registrationsCharts/useRegistrationsTileChartSetup";
import { RegistrationsChannelModePicker } from "./RegistrationsChannelModePicker";

type Props = {
  events: RegistrationsEventSerie[];
  emphasizedEventSlug: string;
  standIso?: string | null;
  kiosk?: boolean;
  showChartExportMenu?: boolean;
  compactForEmbed?: boolean;
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

const WEEKLY_EMBED: EmbedChartQuery = "reg-weekly";

export function RegistrationsWeeklyTile({
  events,
  emphasizedEventSlug,
  standIso,
  kiosk = false,
  showChartExportMenu = true,
  compactForEmbed = false,
}: Props) {
  const captureRef = useRef<HTMLDivElement | null>(null);
  const { chartW, lineChartHeadPadRFraction, onsitePossible, chartMode, setMode } =
    useRegistrationsTileChartSetup(events);
  const plotHeight = compactForEmbed ? 280 : 300;

  const series = useMemo(
    () => buildWeeklySeriesForMode(events, emphasizedEventSlug, chartMode),
    [events, emphasizedEventSlug, chartMode]
  );
  const hasData = series.some((s) => s.points.length > 0);

  return (
    <div ref={captureRef} className="chart-capture-root">
      <section
        className="stat-reg-chart stat-reg-chart--registrations-line"
        aria-labelledby="stat-reg-week-title"
        style={{ "--stat-reg-plot-pad-r-fr": String(lineChartHeadPadRFraction) } as CSSProperties}
      >
        <div className="stat-reg-chart__head">
          <h3 id="stat-reg-week-title" className="stat-reg-chart__title">
            FOSSGIS Anmeldungen pro Woche
            {" "}
            <ChartStandInline iso={standIso} />
          </h3>
          <div className="stat-reg-chart__head-tools">
            {showChartExportMenu ? (
              <ChartExportMenu
                captureRef={captureRef}
                fileNameBase="FOSSGIS-Anmeldungen-pro-Woche"
                embedChart={WEEKLY_EMBED}
                event={emphasizedEventSlug}
                hidden={kiosk}
                disabled={!hasData}
              />
            ) : null}
            <RegistrationsChannelModePicker
              mode={chartMode}
              onChange={setMode}
              onsitePossible={onsitePossible}
              ariaLabel="Kanal nach Woche"
            />
          </div>
        </div>
        {hasData ? (
          <LineChart
            key={chartMode}
            series={series}
            width={chartW}
            padR={REGISTRATIONS_LINE_CHART_PAD_R}
            height={plotHeight}
            xLabel="Wochen vor Konferenzbeginn"
            yLabel={registrationsYAxisLabel[chartMode]}
            invertX
            formatXTick={(w) => String(Math.round(w))}
            formatY={formatRegistrationsCountDe}
            formatHoverBody={(weeks, val) => formatRegistrationsWeeklyHoverCaption(weeks, val)}
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
    </div>
  );
}
