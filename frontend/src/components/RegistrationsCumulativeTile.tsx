import { useMemo, useRef, type CSSProperties } from "react";
import type { EmbedChartQuery } from "../chartEmbed";
import {
  formatRegistrationsCumulativeHoverCaption,
  formatRegistrationsCountDe,
  pointsThroughConferenceStart,
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

function buildCumulativeSeriesForMode(
  events: RegistrationsEventSerie[],
  emphasizedEventSlug: string,
  mode: RegistrationsChannelMode
): LineSeries[] {
  return events.map((ev, i) => {
    const color = registrationsSeriesStrokeColor(i, ev.slug === emphasizedEventSlug);
    const emph = ev.slug === emphasizedEventSlug;
    const sorted = pointsThroughConferenceStart([...ev.points]).sort(
      (a, b) => a.weeksBefore - b.weeksBefore
    );
    let points: { x: number; y: number }[];
    if (mode === "online") {
      points = sorted.map((p) => ({ x: p.weeksBefore, y: p.online }));
    } else if (mode === "onsite") {
      points = sorted
        .filter((p) => p.onsite != null)
        .map((p) => ({ x: p.weeksBefore, y: p.onsite as number }));
    } else {
      points = sorted.map((p) => ({
        x: p.weeksBefore,
        y: p.online + (p.onsite ?? 0),
      }));
    }
    return {
      id: `${ev.slug}-cum-${mode}`,
      label: ev.label,
      emphasize: emph,
      color,
      points,
    };
  });
}

const CUMULATIVE_EMBED: EmbedChartQuery = "reg-cumulative";

export function RegistrationsCumulativeTile({
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
    () => buildCumulativeSeriesForMode(events, emphasizedEventSlug, chartMode),
    [events, emphasizedEventSlug, chartMode]
  );
  const hasData = series.some((s) => s.points.length > 1);

  return (
    <div ref={captureRef} className="chart-capture-root">
      <section
        className="stat-reg-chart stat-reg-chart--registrations-line"
        aria-labelledby="stat-reg-cum-title"
        style={{ "--stat-reg-plot-pad-r-fr": String(lineChartHeadPadRFraction) } as CSSProperties}
      >
        <div className="stat-reg-chart__head">
          <h3 id="stat-reg-cum-title" className="stat-reg-chart__title">
            FOSSGIS Anmeldungen kumuliert
            {" "}
            <ChartStandInline iso={standIso} />
          </h3>
          <div className="stat-reg-chart__head-tools">
            {showChartExportMenu ? (
              <ChartExportMenu
                captureRef={captureRef}
                fileNameBase="FOSSGIS-Anmeldungen-kumuliert"
                embedChart={CUMULATIVE_EMBED}
                event={emphasizedEventSlug}
                hidden={kiosk}
                disabled={!hasData}
              />
            ) : null}
            <RegistrationsChannelModePicker
              mode={chartMode}
              onChange={setMode}
              onsitePossible={onsitePossible}
              ariaLabel="Kumulativ: Verkaufskanal"
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
            formatXTick={(w) =>
              new Intl.NumberFormat("de-DE", { maximumFractionDigits: w % 1 === 0 ? 0 : 1 }).format(w)
            }
            formatY={formatRegistrationsCountDe}
            formatHoverBody={(weeks, val) => formatRegistrationsCumulativeHoverCaption(weeks, val)}
            hoverSnapToNearestX
            selectableSeries={series.length > 1}
          />
        ) : (
          <p className="stat-reg-chart__empty">
            {chartMode === "onsite"
              ? "Keine vor-Ort-Werte in der Historie."
              : "Noch keine Kurvenpunkte."}
          </p>
        )}
      </section>
    </div>
  );
}
