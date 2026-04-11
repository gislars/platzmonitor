import { formatEntrySortAt } from "../formatEntryDate";
import type { Entry } from "../types";
import { StatusBadge } from "./StatusBadge";

function formatAvailability(entry: Entry): string {
  const a = entry.availability;
  if (a.kind === "unlimited") {
    return "unbegrenzt";
  }
  if (entry.status === "sold_out" || entry.status === "closed") {
    return a.free === 0 ? "0" : String(a.free);
  }
  return String(a.free);
}

export function QuotaCard({ entry }: { entry: Entry }) {
  const showWaiting =
    entry.waitingListEnabled === true &&
    entry.waitingListCount !== null &&
    entry.waitingListCount !== undefined &&
    entry.waitingListCount > 0;

  return (
    <article className="quota-card" aria-labelledby={`quota-${entry.id}`}>
      <p className="quota-card__date">{formatEntrySortAt(entry.sortAt)}</p>
      <div className="quota-card__main">
        <h3 className="quota-card__title" id={`quota-${entry.id}`}>
          {entry.label}
        </h3>
        <StatusBadge status={entry.status} />
      </div>
      <div className="quota-card__free" aria-label="Freie Plätze">
        <span className="quota-card__free-label">Frei</span>
        <span className="quota-card__free-num">{formatAvailability(entry)}</span>
      </div>
      {showWaiting ? (
        <p className="quota-card__waiting" aria-label="Warteliste">
          Warteliste: <strong>{entry.waitingListCount}</strong>
        </p>
      ) : null}
    </article>
  );
}
