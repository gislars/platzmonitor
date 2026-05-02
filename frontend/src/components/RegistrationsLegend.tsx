import type { RegistrationsEventSerie } from "../types";
import { registrationsSeriesStrokeColor } from "../statisticsPalette";

type Props = {
  events: RegistrationsEventSerie[];
  emphasizedEventSlug: string;
};

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
          <span className="stat-reg-legend__label">{ev.label}</span>
        </li>
      ))}
    </ul>
  );
}
