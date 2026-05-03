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
  /** Sortierzeitpunkt (ISO 8601), optional. */
  sortAt?: string | null;
  /** Pretalx-Sessionkennung aus dem Schedule, falls zugeordnet. */
  pretalxCode?: string | null;
  waitingListEnabled?: boolean;
  /** Wartelistenlänge aus pretix oder null, wenn nicht lieferbar. */
  waitingListCount?: number | null;
  /** Kumulativ gebuchte Plätze (Transaktionstimeline) bei unlimited-Kontingent. */
  transactionBooked?: number | null;
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

export interface HistoryPoint {
  t: number;
  booked?: number | null;
  total?: number | null;
  waiting?: number | null;
  free?: number | null;
}

export interface HistorySeries {
  quotaId: string;
  points: HistoryPoint[];
}

export interface HistoryResponse {
  fetchedAt: string;
  bucketSeconds: number;
  recordingStartedAt?: number | null;
  series: HistorySeries[];
}

/** Ein Punkt der Buchungs-Timeline (tägliche Stufen, pretix-Transaktionen). */
export interface BookingTimelinePoint {
  t: number;
  booked: number;
}

export interface BookingTimelineSeries {
  quotaId: string;
  points: BookingTimelinePoint[];
}

export interface BookingTimelineResponse {
  fetchedAt: string;
  granularity?: string;
  source?: string;
  series: BookingTimelineSeries[];
}

export interface RegistrationsPoint {
  date: string;
  weeksBefore: number;
  online: number;
  onsite?: number | null;
}

export interface RegistrationsEventSerie {
  slug: string;
  label: string;
  startDate: string;
  points: RegistrationsPoint[];
}

export interface RegistrationsResponse {
  fetchedAt: string;
  emphasizedEventSlug: string;
  events: RegistrationsEventSerie[];
}
