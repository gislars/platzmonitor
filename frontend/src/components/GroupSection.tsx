import type { GroupRotationMode } from "../config";
import type { Group } from "../types";
import { ChartStandInline } from "./ChartStandInline";
import { PaginatedTileGrid } from "./PaginatedTileGrid";
import { QuotaCard } from "./QuotaCard";

type Props = {
  /** ISO-Zeit des letzten Verfügbarkeitsabrufs (gemeinsam für alle Karten der Gruppe). */
  availabilityFetchedAt?: string | null;
  group: Group;
  tilesPerPage: number;
  cols: number;
  rows: number;
  pageRotationMs: number;
  rotationMode: GroupRotationMode;
  globalPageIndex: number;
  onGlobalPageSelect?: (index: number) => void;
};

export function GroupSection(props: Props) {
  const {
    availabilityFetchedAt,
    group,
    tilesPerPage,
    cols,
    rows,
    pageRotationMs,
    rotationMode,
    globalPageIndex,
    onGlobalPageSelect,
  } = props;
  return (
    <PaginatedTileGrid
      items={group.entries}
      itemKey={(e) => e.id}
      renderItem={(e) => <QuotaCard entry={e} />}
      tilesPerPage={tilesPerPage}
      cols={cols}
      rows={rows}
      pageRotationMs={pageRotationMs}
      rotationMode={rotationMode}
      globalPageIndex={globalPageIndex}
      onGlobalPageSelect={onGlobalPageSelect}
      headerSlot={
        <h2 className="dashboard__section-title" id={`grp-${group.id}`}>
          {group.title}
          {" "}
          <ChartStandInline iso={availabilityFetchedAt} />
        </h2>
      }
      emptyText="Keine Einträge in dieser Gruppe."
      wrapperClassName="dashboard__section"
      ariaLabelledBy={`grp-${group.id}`}
    />
  );
}
