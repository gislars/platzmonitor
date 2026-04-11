import { useEffect, useMemo, useState } from "react";
import { chunkArray } from "../chunkArray";
import type { GroupRotationMode } from "../config";
import type { Group } from "../types";
import { PageIndicator } from "./PageIndicator";
import { QuotaCard } from "./QuotaCard";

type Props = {
  group: Group;
  tilesPerPage: number;
  cols: number;
  rows: number;
  pageRotationMs: number;
  rotationMode: GroupRotationMode;
  /** Bei `global`: gemeinsamer Zähler vom Dashboard (Seitenwechsel synchron). */
  globalPageIndex: number;
  /** Bei `global`: Seite per Indikator setzen (gemeinsamer Index). */
  onGlobalPageSelect?: (index: number) => void;
};

export function GroupSection({
  group,
  tilesPerPage,
  cols,
  rows,
  pageRotationMs,
  rotationMode,
  globalPageIndex,
  onGlobalPageSelect,
}: Props) {
  const pages = useMemo(
    () => chunkArray(group.entries, tilesPerPage),
    [group.entries, tilesPerPage]
  );

  const [page, setPage] = useState(0);

  useEffect(() => {
    if (rotationMode !== "perGroup") {
      return;
    }
    if (pages.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % pages.length);
    }, pageRotationMs);
    return () => window.clearInterval(id);
  }, [rotationMode, pages.length, pageRotationMs]);

  const safePage =
    rotationMode === "global"
      ? pages.length === 0
        ? 0
        : globalPageIndex % pages.length
      : pages.length === 0
        ? 0
        : Math.min(page, pages.length - 1);

  const slice = pages[safePage] ?? [];

  const onSelectPage =
    pages.length > 1
      ? rotationMode === "global"
        ? onGlobalPageSelect
        : (i: number) => setPage(i)
      : undefined;

  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  } as const;

  return (
    <section className="dashboard__section" aria-labelledby={`grp-${group.id}`}>
      <div className="dashboard__section-head">
        <h2 className="dashboard__section-title" id={`grp-${group.id}`}>
          {group.title}
        </h2>
        {pages.length > 1 ? (
          <PageIndicator total={pages.length} current={safePage} onSelectPage={onSelectPage} />
        ) : null}
      </div>
      {group.entries.length === 0 ? (
        <p className="dashboard__empty">Keine Einträge in dieser Gruppe.</p>
      ) : (
        <ul className="dashboard__grid" style={gridStyle}>
          {slice.map((e) => (
            <li key={e.id} className="dashboard__grid-cell">
              <QuotaCard entry={e} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
