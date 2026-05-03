import type { Entry } from "../types";
import { entryBooked, entryFreePlaces, entryWaitingList } from "../entryStats";
import { formatRegistrationsCountDe } from "../registrationCharts";

type Props = {
  entries: Entry[];
  kiosk: boolean;
  onOpenEntryDetail?: (entry: Entry) => void;
};

function finiteCapacityTotal(entry: Entry): number | null {
  return entry.availability.kind === "finite" && entry.availability.total != null ? entry.availability.total : null;
}

/** Prozentanteil der Schiene (0–100+, Werte über 100 bei Überbuchung möglich). */
function ratio100AllowOver(v: number, max: number): number {
  if (!(max > 1e-9)) {
    return 0;
  }
  return Math.max(0, (v / max) * 100);
}

/** Maximale endliche Kapazität in der Liste (Skalierung der Balken mit fester Obergrenze). */
function chartMaxFiniteCap(entries: readonly Entry[]): number {
  let m = 0;
  let any = false;
  for (const e of entries) {
    const c = finiteCapacityTotal(e);
    if (c != null) {
      any = true;
      m = Math.max(m, c);
    }
  }
  return any ? Math.max(1, m) : 1;
}

/** Obergrenze für Balkenlänge bei Einträgen ohne endliche Kapazität (max. gebucht). */
function chartMaxBookedWithoutFiniteCap(entries: readonly Entry[]): number {
  let m = 0;
  let any = false;
  for (const e of entries) {
    if (finiteCapacityTotal(e) != null) {
      continue;
    }
    any = true;
    m = Math.max(m, entryBooked(e) ?? 0);
  }
  return any ? Math.max(1, m) : 1;
}

/** Balken je Eintrag: frei, gebucht, Warteliste; optional Klick für Details. */
export function BookingBarChart({ entries, kiosk, onOpenEntryDetail }: Props) {
  const fmt = formatRegistrationsCountDe;

  if (entries.length === 0) {
    return <p className="stat-reg-chart__empty">Keine Einträge.</p>;
  }

  const canTap = Boolean(!kiosk && onOpenEntryDetail);
  const mxCap = chartMaxFiniteCap(entries);
  const mxOpen = chartMaxBookedWithoutFiniteCap(entries);

  return (
    <div className="stat-bar-chart" role="list">
      {entries.map((e) => {
        const booked = entryBooked(e);
        const b = booked ?? 0;
        const wait = entryWaitingList(e);
        const cap = finiteCapacityTotal(e);
        const freeRaw = entryFreePlaces(e);
        const free = cap != null ? Math.max(0, freeRaw ?? Math.max(0, cap - b)) : 0;
        const unlim = e.availability.kind === "unlimited";

        const capacityPctOnly =
          cap != null ? ratio100AllowOver(cap, mxCap) : ratio100AllowOver(b, mxOpen);

        const capPhrase =
          cap != null ? ` von ${fmt(cap)}` : unlim ? " (ohne Kapazitätsgrenze)" : "";

        let numsMain: string;
        let numsWaitLine: string | null = null;
        if (cap != null) {
          numsMain = free > 0 ? `${fmt(free)} frei` : "ausgebucht";
          if (wait > 0) {
            numsWaitLine = `Warteliste ${fmt(wait)}`;
          }
        } else if (unlim) {
          numsMain = booked != null ? `${fmt(b)} gebucht` : "unbegrenzt";
          if (wait > 0) {
            numsWaitLine = `Warteliste ${fmt(wait)}`;
          }
        } else {
          numsMain = booked != null ? fmt(booked) : "?";
          if (wait > 0) {
            numsWaitLine = `Warteliste ${fmt(wait)}`;
          }
        }
        const numsColumn = numsWaitLine !== null ? `${numsMain} · ${numsWaitLine}` : numsMain;

        const ariaLive = `${e.label}: ${fmt(b)}${capPhrase} gebucht.${wait > 0 ? ` ${fmt(wait)} in der Warteliste.` : ""}`;

        const showBookedOnSeg = b > 0 && cap != null && b < cap;

        const hasWaitSeg = wait > 0;

        const waitExtRem = "2.45rem";
        const railInnerWidth = hasWaitSeg
          ? `calc(${String(capacityPctOnly)}% + ${waitExtRem})`
          : `${String(capacityPctOnly)}%`;

        const railInnerStyle = {
          width: railInnerWidth,
          maxWidth: hasWaitSeg || capacityPctOnly > 100 + 1e-6 ? ("none" as const) : "100%",
        } as const;

        const finiteCapacityFlex =
          cap != null
            ? hasWaitSeg
              ? ({ flex: "1 1 auto", minWidth: 0 } as const)
              : ({ flex: "1 1 auto", minWidth: 0, width: "100%" } as const)
            : ({ flex: "1 1 auto", minWidth: 0, width: "100%" } as const);

        const openCapacityFlex =
          hasWaitSeg && b > 0
            ? ({ flex: "1 1 auto", minWidth: 0 } as const)
            : ({ flex: "1 1 auto", minWidth: 0, width: "100%" } as const);

        const capacityBar =
          cap != null ? (
            <span
              className="stat-bar-chart__rail-inner stat-bar-chart__rail-inner--horiz"
              style={railInnerStyle}
            >
              <span className="stat-bar-chart__rail-capacity" style={finiteCapacityFlex}>
                <span
                  className="stat-bar-chart__cap-band"
                  title={`Kapazität ${fmt(cap)} (${fmt(b)} gebucht, ${fmt(free)} frei)`}
                >
                  <span className="stat-bar-chart__cap-fill">
                    {b > 0 ? (
                      <span
                        className="stat-bar-chart__seg stat-bar-chart__seg--booked"
                        style={{ flex: `${String(b)} 1 0` }}
                      >
                        {showBookedOnSeg ? (
                          <span className="stat-bar-chart__bar-num stat-bar-chart__bar-num--on-booked">{fmt(b)}</span>
                        ) : null}
                      </span>
                    ) : null}
                    {free > 0 ? (
                      <span className="stat-bar-chart__seg stat-bar-chart__seg--free" style={{ flex: `${String(free)} 1 0` }} />
                    ) : null}
                  </span>
                  <span
                    className={`stat-bar-chart__bar-num stat-bar-chart__bar-num--cap-end${free === 0 && b > 0 ? " stat-bar-chart__bar-num--cap-end-on-dark" : ""}`}
                  >
                    {fmt(cap)}
                  </span>
                </span>
              </span>
              {hasWaitSeg ? (
                <span
                  className="stat-bar-chart__wait-tail stat-bar-chart__wait-tail--fixed-ext"
                  title={`Warteliste ${fmt(wait)}`}
                >
                  <span className="stat-bar-chart__bar-num stat-bar-chart__bar-num--on-wait">{fmt(wait)}</span>
                </span>
              ) : null}
            </span>
          ) : (
            <span
              className="stat-bar-chart__rail-inner stat-bar-chart__rail-inner--horiz"
              style={railInnerStyle}
            >
              {b > 0 ? (
                <span className="stat-bar-chart__rail-capacity" style={openCapacityFlex}>
                  <span className="stat-bar-chart__seg stat-bar-chart__seg--booked stat-bar-chart__seg--unlim stat-bar-chart__seg--unlim-fill">
                    <span className="stat-bar-chart__bar-num stat-bar-chart__bar-num--on-booked">{fmt(b)}</span>
                  </span>
                </span>
              ) : null}
              {hasWaitSeg ? (
                <span
                  className="stat-bar-chart__wait-tail stat-bar-chart__wait-tail--fixed-ext"
                  title={`Warteliste ${fmt(wait)}`}
                >
                  <span className="stat-bar-chart__bar-num stat-bar-chart__bar-num--on-wait">{fmt(wait)}</span>
                </span>
              ) : null}
            </span>
          );

        const rowInner = (
          <>
            <span className="stat-bar-chart__label" title={e.label}>
              {e.label}
            </span>
            <span className="stat-bar-chart__rail" aria-hidden>
              {capacityBar}
            </span>
            <span className="stat-bar-chart__nums" title={numsColumn}>
              {numsWaitLine !== null ? (
                <>
                  <span className="stat-bar-chart__nums-primary">{numsMain}</span>
                  <span className="stat-bar-chart__nums-wait">{numsWaitLine}</span>
                </>
              ) : (
                numsMain
              )}
            </span>
          </>
        );

        const rowClass = `stat-bar-chart__item stat-bar-chart__row${canTap ? " stat-bar-chart__row--interactive" : ""}`;

        return canTap ? (
          <button
            key={e.id}
            type="button"
            className={rowClass}
            role="listitem"
            aria-label={ariaLive}
            onClick={() => onOpenEntryDetail?.(e)}
          >
            {rowInner}
          </button>
        ) : (
          <div key={e.id} className={rowClass} role="listitem" aria-label={ariaLive}>
            {rowInner}
          </div>
        );
      })}
    </div>
  );
}
