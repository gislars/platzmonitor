import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "highlight.js/styles/github.css";
import {
  buildAbsoluteEmbedPageUrl,
  buildWidgetEmbedSnippetParts,
  type EmbedChartQuery,
  type WidgetEmbedSnippetParts,
} from "../chartEmbed";
import type { WidgetEmbedDialogConfig } from "./ChartExportMenu";
import { useEventsCatalog } from "../useEventsCatalog";

hljs.registerLanguage("xml", xml);

type Props = {
  open: boolean;
  onClose: () => void;
  embed: WidgetEmbedDialogConfig | null;
};

type CopyFeedback = { kind: "success" | "error"; message: string };

function isRegistrationsChart(chart: EmbedChartQuery): boolean {
  return chart === "reg-weekly" || chart === "reg-cumulative";
}

function extractYear(slug: string): string {
  const m = /(?:^|[^0-9])(20[0-9]{2}|19[0-9]{2})(?:[^0-9]|$)/.exec(slug);
  return m?.[1] ?? slug;
}

function yearToggleStyle(pressed: boolean, disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,.22)",
    fontWeight: 650,
    lineHeight: 1.1,
    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",
  };
  if (!pressed) {
    return {
      ...base,
      background: "transparent",
      color: "inherit",
      opacity: disabled ? 0.55 : 1,
      borderStyle: disabled ? "dashed" : "solid",
    };
  }
  return {
    ...base,
    background: "var(--accent, #ee7f00)",
    borderColor: "var(--accent, #ee7f00)",
    color: "#fff",
    opacity: disabled ? 0.7 : 1,
    borderStyle: disabled ? "dashed" : "solid",
  };
}

export function WidgetEmbedCodeDialog({ open, onClose, embed }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string> | null>(null);

  const chart = embed?.chart ?? null;
  const event = (embed?.event ?? "").trim();

  const catalogEnabled =
    open && embed !== null && isRegistrationsChart(embed.chart);
  const { events, error: eventsError } = useEventsCatalog(catalogEnabled);

  const previousEvents = useMemo(() => {
    if (!event || events === null) {
      return [];
    }
    const list = events.filter((e) => e.slug !== event);
    const key = (s: string) => {
      const y = extractYear(s);
      const n = Number.parseInt(y, 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    // Aufsteigend: aeltestes Jahr zuerst
    return [...list].sort((a, b) => key(a.slug) - key(b.slug) || a.slug.localeCompare(b.slug));
  }, [event, events]);

  // Default: alle Vorjahre aktiv (selectedSlugs===null -> shortcut previous)
  const registrationsInclude = useMemo((): string | undefined => {
    if (embed === null || !isRegistrationsChart(embed.chart)) {
      return undefined;
    }
    if (eventsError) {
      return "previous";
    }
    if (selectedSlugs === null) {
      return "previous";
    }
    if (selectedSlugs.size === 0) {
      return undefined;
    }
    const slugs = [...selectedSlugs].sort();
    if (
      slugs.length === previousEvents.length &&
      slugs.every((s) => previousEvents.some((e) => e.slug === s))
    ) {
      return "previous";
    }
    return slugs.join(",");
  }, [embed, eventsError, previousEvents, selectedSlugs]);

  const parts: WidgetEmbedSnippetParts | null = useMemo(() => {
    if (embed === null) {
      return null;
    }
    const include = registrationsInclude;
    const standalone = buildAbsoluteEmbedPageUrl(embed.chart, {
      event: embed.event,
      include,
      quotaId: embed.quotaId,
    });
    return buildWidgetEmbedSnippetParts({
      scriptUrl: embed.scriptUrl,
      event: embed.event,
      chart: embed.chart,
      quotaId: embed.quotaId,
      registrationsInclude: include,
      standaloneEmbedUrl: standalone,
    });
  }, [embed, registrationsInclude]);

  const hlGlobal = useMemo(() => {
    if (parts === null) {
      return "";
    }
    return hljs.highlight(parts.globalBlock, { language: "xml" }).value;
  }, [parts]);

  const hlDiv = useMemo(() => {
    if (parts === null) {
      return "";
    }
    return hljs.highlight(parts.divBlock, { language: "xml" }).value;
  }, [parts]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>("button[data-autofocus]")?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      const id = requestAnimationFrame(() => {
        setCopyFeedback(null);
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

  async function copyText(text: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ kind: "success", message: okMessage });
      window.setTimeout(() => setCopyFeedback(null), 2400);
    } catch {
      setCopyFeedback({ kind: "error", message: "Kopieren fehlgeschlagen." });
      window.setTimeout(() => setCopyFeedback(null), 4000);
    }
  }

  if (!open || parts === null || embed === null || chart === null) {
    return null;
  }

  return createPortal(
    <div className="widget-embed-dialog__root">
      <button
        type="button"
        className="widget-embed-dialog__backdrop"
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="widget-embed-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="widget-embed-dialog__head">
          <h2 id={titleId} className="widget-embed-dialog__title">
            Widget einbetten
          </h2>
          <button type="button" className="widget-embed-dialog__close" onClick={onClose}>
            Schließen
          </button>
        </div>

        <ol className="widget-embed-dialog__steps">
          <li>Gesamten Code kopieren und den oberen Block (Skript) einmal im Kopf der Seite einfügen.</li>
          <li>
            Den unteren Block (<code>div</code> mit Platzhalter) an der Stelle einfügen, an der das Diagramm erscheinen
            soll.
          </li>
        </ol>

        <div className="widget-embed-dialog__primary">
          <button
            type="button"
            className="widget-embed-dialog__copy-btn widget-embed-dialog__copy-btn--primary"
            data-autofocus
            onClick={() => void copyText(parts.fullCombined, "Gesamter Code in die Zwischenablage kopiert.")}
          >
            Gesamten Einbettungscode kopieren
          </button>
        </div>

        {copyFeedback !== null ? (
          <div
            className={
              copyFeedback.kind === "success"
                ? "widget-embed-dialog__feedback widget-embed-dialog__feedback--success"
                : "widget-embed-dialog__feedback widget-embed-dialog__feedback--error"
            }
            role={copyFeedback.kind === "error" ? "alert" : "status"}
            aria-live={copyFeedback.kind === "error" ? "assertive" : "polite"}
          >
            {copyFeedback.message}
          </div>
        ) : null}

        <details className="widget-embed-dialog__advanced">
          <summary className="widget-embed-dialog__advanced-summary">
            Erweitert: nur Kopf-Block oder nur Diagramm kopieren
          </summary>
          <div className="widget-embed-dialog__advanced-body">
            {isRegistrationsChart(chart) ? (
              <section className="widget-embed-dialog__block" aria-labelledby={`${titleId}-s0`}>
                <div className="widget-embed-dialog__block-head">
                  <h3 id={`${titleId}-s0`} className="widget-embed-dialog__block-title">
                    Jahre im Widget
                  </h3>
                </div>
                {eventsError ? (
                  <p className="widget-embed-dialog__steps" role="note">
                    Jahre nicht ladbar. Verwende Standard: alle Vorjahre.
                  </p>
                ) : events === null ? (
                  <p className="widget-embed-dialog__steps" role="note">
                    Jahre werden geladen.
                  </p>
                ) : (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      <button
                        type="button"
                        className="widget-embed-dialog__copy-btn"
                        aria-pressed={selectedSlugs === null}
                        style={yearToggleStyle(selectedSlugs === null, false)}
                        title="Alle Vorjahre anzeigen"
                        onClick={() => setSelectedSlugs(null)}
                      >
                        Alle
                      </button>
                      {previousEvents.map((ev) => {
                        const pressed = selectedSlugs === null ? true : selectedSlugs.has(ev.slug);
                        return (
                          <button
                            key={ev.slug}
                            type="button"
                            className="widget-embed-dialog__copy-btn"
                            aria-pressed={pressed}
                            style={yearToggleStyle(pressed, false)}
                            onClick={() => {
                              setSelectedSlugs((prev) => {
                                const next = new Set(prev ?? previousEvents.map((x) => x.slug));
                                if (next.has(ev.slug)) {
                                  next.delete(ev.slug);
                                } else {
                                  next.add(ev.slug);
                                }
                                return next;
                              });
                            }}
                            title={ev.title ?? ev.slug}
                          >
                            {extractYear(ev.slug)}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="widget-embed-dialog__copy-btn"
                        aria-pressed={true}
                        disabled
                        title="Aktuelles Jahr ist immer enthalten und kann nicht abgewählt werden"
                        style={yearToggleStyle(true, true)}
                      >
                        Aktuell {extractYear(event)}
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            <section className="widget-embed-dialog__block" aria-labelledby={`${titleId}-s1`}>
              <div className="widget-embed-dialog__block-head">
                <h3 id={`${titleId}-s1`} className="widget-embed-dialog__block-title">
                  Kopf: Kommentar, Skript und noscript
                </h3>
                <button
                  type="button"
                  className="widget-embed-dialog__copy-btn"
                  onClick={() => void copyText(parts.globalBlock, "Kopf-Block kopiert.")}
                >
                  Kopieren
                </button>
              </div>
              <pre className="widget-embed-dialog__pre">
                <code className="hljs language-xml" dangerouslySetInnerHTML={{ __html: hlGlobal }} />
              </pre>
            </section>

            <section className="widget-embed-dialog__block" aria-labelledby={`${titleId}-s2`}>
              <div className="widget-embed-dialog__block-head">
                <h3 id={`${titleId}-s2`} className="widget-embed-dialog__block-title">
                  Diagramm: Platzhalter-Div
                </h3>
                <button
                  type="button"
                  className="widget-embed-dialog__copy-btn"
                  onClick={() => void copyText(parts.divBlock, "Diagramm-Block kopiert.")}
                >
                  Kopieren
                </button>
              </div>
              <pre className="widget-embed-dialog__pre">
                <code className="hljs language-xml" dangerouslySetInnerHTML={{ __html: hlDiv }} />
              </pre>
            </section>
          </div>
        </details>
      </div>
    </div>,
    document.body
  );
}
