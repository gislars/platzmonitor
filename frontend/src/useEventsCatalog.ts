import { useEffect, useMemo, useState } from "react";
import { fetchEventsCatalog, type EventsCatalogEntry } from "./api";

/** Sortierung wie Backend (Enddatum absteigend): neuestes Jahr zuerst im UI. */
export function sortEventsCatalogByEndDateDesc(
  events: readonly EventsCatalogEntry[]
): EventsCatalogEntry[] {
  const toKey = (ev: EventsCatalogEntry) =>
    (ev.endDate ?? "").trim() || (ev.startDate ?? "").trim() || (ev.slug ?? "").trim();
  return [...events].sort((a, b) => toKey(b).localeCompare(toKey(a)));
}

export function useEventsCatalog(enabled: boolean) {
  const [events, setEvents] = useState<EventsCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void fetchEventsCatalog()
      .then((r) => {
        if (cancelled) {
          return;
        }
        setEvents(r.events);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) {
          return;
        }
        setEvents(null);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const sortedEvents = useMemo(() => sortEventsCatalogByEndDateDesc(events ?? []), [events]);

  return { events, sortedEvents, error };
}
