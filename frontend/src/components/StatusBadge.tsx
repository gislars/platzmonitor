import type { EntryStatus } from "../types";

const LABELS: Record<EntryStatus, string> = {
  open: "Frei",
  sold_out: "Ausgebucht",
  closed: "Geschlossen",
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}
