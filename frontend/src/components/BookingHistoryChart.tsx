import { useId } from "react";
import type { Entry } from "../types";
import { BookingBarChart } from "./BookingBarChart";
import { ChartStandInline } from "./ChartStandInline";

type Props = {
  title: string;
  /** ISO-Zeit der Verfügbarkeitsdaten (pretix-Schnappschuss für die Balken). */
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

  return (
    <section className="stat-reg-chart" aria-labelledby={titleId}>
      <div className="stat-reg-chart__head">
        <h3 id={titleId} className="stat-reg-chart__title">
          {title}
          {" "}
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
