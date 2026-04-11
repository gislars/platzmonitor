export interface AvailabilityFinite {
  kind: "finite";
  free: number;
  total: number | null;
}

export interface AvailabilityUnlimited {
  kind: "unlimited";
}

export type Availability = AvailabilityFinite | AvailabilityUnlimited;

export type EntryStatus = "open" | "sold_out" | "closed";

export interface Entry {
  id: string;
  label: string;
  groupId: string;
  availability: Availability;
  status: EntryStatus;
  /** ISO 8601, für Sortierung (optional) */
  sortAt?: string | null;
  waitingListEnabled?: boolean;
  /** null, wenn pretix-Warteliste nicht abrufbar (z. B. fehlende Token-Rechte) */
  waitingListCount?: number | null;
}

export interface Group {
  id: string;
  title: string;
  entries: Entry[];
}

export interface AvailabilityResponse {
  fetchedAt: string;
  event: { organizer: string; slug: string; title: string };
  groups: Group[];
}
