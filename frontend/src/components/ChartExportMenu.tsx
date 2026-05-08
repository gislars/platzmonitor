import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import {
  buildPublicEmbedScriptUrl,
  type EmbedChartQuery,
} from "../chartEmbed";
import { WidgetEmbedCodeDialog } from "./WidgetEmbedCodeDialog";

/** Klassen für den html-to-image-`filter`: Menü und ausgeschlossene Knoten nicht im PNG. */
const MENU_FILTER_CLASS = "chart-export-menu";
const PNG_EXCLUDE_CLASS = "chart-png-exclude";

function exportDomFilter(node: Element): boolean {
  if (!(node instanceof HTMLElement)) {
    return true;
  }
  if (node.closest(`.${MENU_FILTER_CLASS}`) !== null) {
    return false;
  }
  if (node.closest(`.${PNG_EXCLUDE_CLASS}`) !== null) {
    return false;
  }
  return true;
}

function slugifyDownloadBase(raw: string): string {
  const t = raw
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return t.length > 0 ? t : "diagramm";
}

type Props = {
  captureRef: RefObject<HTMLElement | null>;
  fileNameBase: string;
  embedChart: EmbedChartQuery;
  event: string;
  embedQuotaId?: string;
  hidden?: boolean;
  disabled?: boolean;
};

export type WidgetEmbedDialogConfig = {
  scriptUrl: string;
  chart: EmbedChartQuery;
  event: string;
  quotaId?: string;
};

export function ChartExportMenu({
  captureRef,
  fileNameBase,
  embedChart,
  event,
  embedQuotaId,
  hidden = false,
  disabled = false,
}: Props) {
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [embedConfig, setEmbedConfig] = useState<WidgetEmbedDialogConfig | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const close = () => {
      setMenuOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [menuOpen]);

  const runPngDownload = useCallback(async () => {
    setStatus(null);
    const el = captureRef.current;
    if (!el) {
      setStatus("Kein Diagramm-Bereich.");
      return;
    }
    try {
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        filter: exportDomFilter,
      });
      const slug = slugifyDownloadBase(fileNameBase);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const name = `${slug}-${stamp}.png`;
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("PNG gespeichert.");
      setMenuOpen(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "PNG-Export fehlgeschlagen.");
    }
  }, [captureRef, fileNameBase]);

  const liveEmbedNeedsQuota =
    embedChart === "booking-detail" && (embedQuotaId === undefined || embedQuotaId === "");

  const openEmbedDialog = useCallback(() => {
    setStatus(null);
    if (liveEmbedNeedsQuota) {
      setStatus("Live-Embed für dieses Diagramm nicht verfügbar.");
      return;
    }
    if (!event || event.trim() === "") {
      setStatus("Jahr nicht gesetzt.");
      return;
    }
    if (captureRef.current === null) {
      setStatus("Kein Diagramm-Bereich.");
      return;
    }
    setEmbedConfig({
      scriptUrl: buildPublicEmbedScriptUrl(),
      event,
      chart: embedChart,
      quotaId: embedChart === "booking-detail" ? embedQuotaId : undefined,
    });
    setMenuOpen(false);
  }, [captureRef, embedChart, embedQuotaId, event, liveEmbedNeedsQuota]);

  if (hidden) {
    return null;
  }

  return (
    <div className={MENU_FILTER_CLASS} ref={rootRef}>
      <button
        type="button"
        className="chart-export-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        disabled={disabled}
        title="Diagramm exportieren oder einbetten"
        onClick={() => {
          setMenuOpen((v) => !v);
        }}
      >
        <span className="chart-export-menu__dots" aria-hidden>
          ⋮
        </span>
        <span className="visually-hidden">Diagramm-Aktionen</span>
      </button>
      {menuOpen ? (
        <ul id={menuId} className="chart-export-menu__dropdown" role="menu">
          <li role="presentation">
            <button type="button" className="chart-export-menu__item" role="menuitem" onClick={() => void runPngDownload()}>
              Als PNG speichern
            </button>
          </li>
          <li role="presentation">
            <button
              type="button"
              className="chart-export-menu__item"
              role="menuitem"
              disabled={liveEmbedNeedsQuota}
              title={
                liveEmbedNeedsQuota ? "Für Live-Embed wird eine Quota-ID benötigt." : undefined
              }
              onClick={() => {
                openEmbedDialog();
              }}
            >
              Widget-Einbettungscode anzeigen
            </button>
          </li>
        </ul>
      ) : null}
      <WidgetEmbedCodeDialog
        open={embedConfig !== null}
        embed={embedConfig}
        onClose={() => setEmbedConfig(null)}
      />
      {status !== null ? (
        <p className="chart-export-menu__status" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </div>
  );
}
