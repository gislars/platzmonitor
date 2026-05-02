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
  /** Pretalx-Session-Code bei Titel-Match im Schedule; sonst null/undefined */
  pretalxCode?: string | null;
  waitingListEnabled?: boolean;
  /** null, wenn pretix-Warteliste nicht abrufbar (z. B. fehlende Token-Rechte) */
  waitingListCount?: number | null;
  /** Bei unlimited: kumulativ gebucht laut Transaktions-Timeline (vom Backend angereichert). */
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

/** Kumulativa aus pretix-Transaktionen (Workshop/Exkursion), Backend /booking-timeline */
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
