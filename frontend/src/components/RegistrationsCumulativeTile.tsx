import { useMemo } from "react";
import {
  formatRegistrationsCumulativeHoverCaption,
  formatRegistrationsCountDe,
  pointsThroughConferenceStart,
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
  interactionChartKey?: string;
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

const Y_LABEL: Record<RegistrationsChannelMode, string> = {
  online: "Online",
  onsite: "Vor Ort",
  total: "Anmeldungen (Gesamt)",
};

export function RegistrationsCumulativeTile({
  events,
  emphasizedEventSlug,
  standIso,
  interactionChartKey,
}: Props) {
  const { chartW, onPlotHoverChange, peerDimmed, onsitePossible, chartMode, setMode } =
    useRegistrationsTileChartSetup(events, interactionChartKey);

  const series = useMemo(
    () => buildCumulativeSeriesForMode(events, emphasizedEventSlug, chartMode),
    [events, emphasizedEventSlug, chartMode]
  );
  const hasData = series.some((s) => s.points.length > 1);

  return (
    <section
      className={`stat-reg-chart${peerDimmed ? " stat-reg-chart--peer-dimmed" : ""}`}
      aria-labelledby="stat-reg-cum-title"
    >
      <div className="stat-reg-chart__head">
        <h3 id="stat-reg-cum-title" className="stat-reg-chart__title">
          FOSSGIS Anmeldungen kumuliert
          {" "}
          <ChartStandInline iso={standIso} />
        </h3>
        <RegistrationsChannelModePicker
          mode={chartMode}
          onChange={setMode}
          onsitePossible={onsitePossible}
          ariaLabel="Kumulativ: Verkaufskanal"
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
          formatXTick={(w) =>
            new Intl.NumberFormat("de-DE", { maximumFractionDigits: w % 1 === 0 ? 0 : 1 }).format(w)
          }
          formatY={formatRegistrationsCountDe}
          formatHoverBody={(weeks, val) => formatRegistrationsCumulativeHoverCaption(weeks, val)}
          onPlotHoverChange={interactionChartKey !== undefined ? onPlotHoverChange : undefined}
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
  );
}
