import type { Entry, Group } from "./types";
import { sortEntriesByLabelAsc } from "./sortEntries";

/** Gruppe `excursions` vs. alle übrigen Gruppen (Workshops), jeweils nach Label sortiert. */
export function splitBookingHistoryEntries(groups: readonly Group[]): {
  excursionEntries: Entry[];
  workshopEntries: Entry[];
} {
  const excursionFlat: Entry[] = [];
  const workshopFlat: Entry[] = [];
  for (const g of groups) {
    if (g.id === "excursions") {
      excursionFlat.push(...g.entries);
    } else {
      workshopFlat.push(...g.entries);
    }
  }
  return {
    excursionEntries: sortEntriesByLabelAsc(excursionFlat),
    workshopEntries: sortEntriesByLabelAsc(workshopFlat),
  };
}
