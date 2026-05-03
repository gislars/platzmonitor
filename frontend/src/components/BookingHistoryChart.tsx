import { useId } from "react";
import type { Entry } from "../types";
import { BookingBarChart } from "./BookingBarChart";
import { ChartStandInline } from "./ChartStandInline";

type Props = {
  title: string;
  /** Zeitstempel der pretix-Verfügbarkeit für die Balken (ISO). */
  standIso?: string | null;
  subtitle?: string;
  entries: Entry[];
  kiosk: boolean;
  onOpenEntryDetail?: (entry: Entry) => void;
};

export function BookingHistoryChart({
  title,
  standIso,
  subtitle,
  entries,
  kiosk,
  onOpenEntryDetail,
}: Props) {
  const titleId = `stat-hist-${useId().replace(/\W/g, "")}-title`;
  const n = entries.length;
  const countTitle = n === 1 ? "1 Eintrag" : `${String(n)} Einträge`;

  return (
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
      </div>
      {subtitle !== undefined && subtitle.trim().length > 0 ? (
        <p className="stat-reg-chart__hint">{subtitle}</p>
      ) : null}
      <BookingBarChart entries={entries} kiosk={kiosk} onOpenEntryDetail={onOpenEntryDetail} />
    </section>
  );
}
