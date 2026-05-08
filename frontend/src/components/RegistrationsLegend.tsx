import type { RegistrationsEventSerie } from "../types";
import { registrationsSeriesStrokeColor } from "../statisticsPalette";

type Props = {
  events: RegistrationsEventSerie[];
  emphasizedEventSlug: string;
};

function legendYearLabel(ev: RegistrationsEventSerie): string {
  const m = /(?:^|[^0-9])(20[0-9]{2}|19[0-9]{2})(?:[^0-9]|$)/.exec(ev.slug);
  if (m && m[1]) {
    return m[1];
  }
  return ev.slug;
}

export function RegistrationsLegend({ events, emphasizedEventSlug }: Props) {
  if (events.length === 0) {
    return null;
  }

  return (
    <ul className="stat-reg-legend" aria-label="Legende Jahre">
      {events.map((ev, i) => (
        <li key={ev.slug} className="stat-reg-legend__item">
          <span
            className="stat-reg-legend__swatch"
            style={{
              background: registrationsSeriesStrokeColor(
                i,
                ev.slug === emphasizedEventSlug
              ),
            }}
            aria-hidden
          />
          <span className="stat-reg-legend__label">{legendYearLabel(ev)}</span>
        </li>
      ))}
    </ul>
  );
}
