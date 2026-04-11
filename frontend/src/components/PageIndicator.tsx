type Props = {
  /** Anzahl Seiten (mindestens 1). */
  total: number;
  /** Aktive Seite, 0-basiert. */
  current: number;
  /** Wenn gesetzt, sind die Segmente per Maus und Tastatur wählbar. */
  onSelectPage?: (index: number) => void;
};

/** Schmale Linien-Segmente: aktives Segment hervorgehoben. */
export function PageIndicator({ total, current, onSelectPage }: Props) {
  const n = Math.max(1, total);
  const active = Math.min(Math.max(0, current), n - 1);
  const interactive = Boolean(onSelectPage) && n > 1;

  return (
    <div
      className="page-indicator"
      role={interactive ? "tablist" : undefined}
      aria-label={`Seiten, ${active + 1} von ${n}`}
    >
      {Array.from({ length: n }, (_, i) => {
        const segClass =
          i === active ? "page-indicator__seg page-indicator__seg--active" : "page-indicator__seg";

        if (interactive && onSelectPage) {
          return (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-current={i === active ? "true" : undefined}
              className={segClass}
              onClick={() => onSelectPage(i)}
              title={`Seite ${i + 1} von ${n}`}
            />
          );
        }

        return (
          <span
            key={i}
            role="presentation"
            className={segClass}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
