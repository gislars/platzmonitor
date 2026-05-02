import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { chunkArray } from "../chunkArray";
import type { GroupRotationMode } from "../config";
import { PageIndicator } from "./PageIndicator";

type Props<T> = {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  tilesPerPage: number;
  cols: number;
  rows: number;
  pageRotationMs: number;
  rotationMode: GroupRotationMode;
  globalPageIndex: number;
  onGlobalPageSelect?: (page: number) => void;
  headerSlot?: ReactNode;
  emptyText?: string;
  wrapperClassName?: string;
  ariaLabelledBy?: string;
  /** Wenn gesetzt und ohne `ariaLabelledBy`, zugänglicher Abschnittsname */
  ariaLabel?: string;
};

export function PaginatedTileGrid<T>({
  items,
  itemKey,
  renderItem,
  tilesPerPage,
  cols,
  rows,
  pageRotationMs,
  rotationMode,
  globalPageIndex,
  onGlobalPageSelect,
  headerSlot,
  emptyText,
  wrapperClassName = "dashboard__section",
  ariaLabelledBy,
  ariaLabel,
}: Props<T>) {
  const pages = useMemo(() => chunkArray(items, tilesPerPage), [items, tilesPerPage]);
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
    /* auto: Zeilen nur so hoch wie Inhalt (kein erzwungenes 1fr bei wenigen Kacheln untereinander). */
    gridTemplateRows: `repeat(${rows}, minmax(0, auto))`,
  } as const;

  return (
    <section
      className={wrapperClassName}
      {...(ariaLabelledBy !== undefined
        ? { "aria-labelledby": ariaLabelledBy }
        : ariaLabel !== undefined
          ? { "aria-label": ariaLabel }
          : {})}
    >
      {(headerSlot != null || pages.length > 1) && (
        <div className="dashboard__section-head">
          {headerSlot ?? <span />}
          {pages.length > 1 ? (
            <PageIndicator total={pages.length} current={safePage} onSelectPage={onSelectPage} />
          ) : null}
        </div>
      )}
      {items.length === 0 ? (
        <p className="dashboard__empty">{emptyText ?? "Keine Einträge."}</p>
      ) : (
        <ul className="dashboard__grid" style={gridStyle}>
          {slice.map((item) => (
            <li key={itemKey(item)} className="dashboard__grid-cell">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
