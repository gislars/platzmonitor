import { useId, useRef } from "react";
import type { EmbedChartQuery } from "../chartEmbed";
import type { Entry } from "../types";
import { BookingBarChart } from "./BookingBarChart";
import { ChartExportMenu } from "./ChartExportMenu";
import { ChartStandInline } from "./ChartStandInline";

type Props = {
  title: string;
  standIso?: string | null;
  subtitle?: string;
  entries: Entry[];
  kiosk: boolean;
  event: string;
  exportEmbedChart?: EmbedChartQuery;
  onOpenEntryDetail?: (entry: Entry) => void;
};

export function BookingHistoryChart({
  title,
  standIso,
  subtitle,
  entries,
  kiosk,
  event,
  exportEmbedChart,
  onOpenEntryDetail,
}: Props) {
  const titleId = `stat-hist-${useId().replace(/\W/g, "")}-title`;
  const n = entries.length;
  const countTitle = n === 1 ? "1 Eintrag" : `${String(n)} Einträge`;
  const captureRef = useRef<HTMLDivElement | null>(null);
  const exportDisabled = n === 0;

  return (
    <div ref={captureRef} className="chart-capture-root">
      <section className="stat-reg-chart" aria-labelledby={titleId}>
        <div className="stat-reg-chart__head">
          <h3 id={titleId} className="stat-reg-chart__title">
            {title}
            <span className="stat-reg-chart__entry-count" title={countTitle}>
              {" "}
              ({n})
            </span>{" "}
            <ChartStandInline iso={standIso} />
          </h3>
          {exportEmbedChart !== undefined ? (
            <ChartExportMenu
              captureRef={captureRef}
              fileNameBase={title}
              embedChart={exportEmbedChart}
              event={event}
              hidden={kiosk}
              disabled={exportDisabled}
            />
          ) : null}
        </div>
        {subtitle !== undefined && subtitle.trim().length > 0 ? (
          <p className="stat-reg-chart__hint">{subtitle}</p>
        ) : null}
        <BookingBarChart entries={entries} kiosk={kiosk} onOpenEntryDetail={onOpenEntryDetail} />
      </section>
    </div>
  );
}
