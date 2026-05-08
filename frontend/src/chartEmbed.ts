/** Erlaubte Werte für den Query-Parameter `chart` auf `/embed`. */
export type EmbedChartQuery =
  | "booking-excursions"
  | "booking-workshops"
  | "reg-weekly"
  | "reg-cumulative"
  | "booking-detail";

const EMBED_CHART_QUERY_VALUES: readonly EmbedChartQuery[] = [
  "booking-excursions",
  "booking-workshops",
  "reg-weekly",
  "reg-cumulative",
  "booking-detail",
];

const EMBED_CHART_QUERY_SET = new Set<string>(EMBED_CHART_QUERY_VALUES);

export function parseEmbedChartQuery(raw: string | null): EmbedChartQuery | null {
  if (raw === null || raw === "") {
    return null;
  }
  return EMBED_CHART_QUERY_SET.has(raw) ? (raw as EmbedChartQuery) : null;
}

/** True, wenn die URL die Embed-Route unter dem SPA-Basis-Pfad ist. */
export function isEmbedPathname(pathname: string, baseUrl: string): boolean {
  const base = baseUrl.replace(/\/+$/, "");
  const path = pathname.replace(/\/+$/, "") || "/";
  if (!base || base === "/") {
    return path === "/embed" || path.startsWith("/embed/");
  }
  if (!path.startsWith(base)) {
    return false;
  }
  const rest = path.slice(base.length).replace(/^\//, "");
  const first = rest.split("/")[0] ?? "";
  return first === "embed";
}

/** Absolute `/embed`-URL inkl. `chart` und ggf. `quotaId`. */
export function buildAbsoluteEmbedPageUrl(
  chart: EmbedChartQuery,
  opts?: { event?: string; include?: string; quotaId?: string }
): string {
  const origin = window.location.origin;
  const rawBase = import.meta.env.BASE_URL;
  const prefix = rawBase === "/" ? "" : rawBase.replace(/\/+$/, "");
  const path = `${prefix}/embed`.replace(/\/+/g, "/");
  const u = new URL(path.startsWith("/") ? path : `/${path}`, origin);
  u.searchParams.set("chart", chart);
  if (opts?.event && opts.event.trim()) {
    u.searchParams.set("event", opts.event.trim());
  }
  if (opts?.include && opts.include.trim()) {
    u.searchParams.set("include", opts.include.trim());
  }
  if (chart === "booking-detail" && opts?.quotaId) {
    u.searchParams.set("quotaId", opts.quotaId);
  }
  return u.href;
}

/**
 * postMessage-Typ-String für Iframe-Höhenanpassung vom eingebetteten Dokument.
 * Muss identisch zu `MSG` in `public/platzmonitor-embed.js` bleiben.
 */
export const EMBED_IFRAME_RESIZE_MESSAGE = "platzmonitor-embed-resize" as const;

/** SPA-Basis-URL inkl. trailing slash (Skript-URL, Embed-Pfade). */
export function buildEmbedAppBaseHref(): string {
  const origin = window.location.origin;
  const rawBase = import.meta.env.BASE_URL || "/";
  const path =
    rawBase === "/" ? "/" : rawBase.endsWith("/") ? rawBase : `${rawBase.replace(/\/+$/, "")}/`;
  return new URL(path, origin).href;
}

/** Absolute URL zum statischen Skript platzmonitor-embed.js. */
export function buildPublicEmbedScriptUrl(): string {
  return new URL("platzmonitor-embed.js", buildEmbedAppBaseHref()).href;
}

function escapeDoubleQuotedAttributeValue(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** HTML-Snippets für den Einbettungsdialog und Kopieren. */
export type WidgetEmbedSnippetParts = {
  /** Skript + noscript, einmal pro einbindender Seite. */
  globalBlock: string;
  /** Platzhalter-Div mit data-Attributen, einmal pro Diagramm. */
  divBlock: string;
  /** Empfohlene Gesamtfolge zum Einfügen. */
  fullCombined: string;
};

export function buildWidgetEmbedSnippetParts(opts: {
  scriptUrl: string;
  event: string;
  chart: EmbedChartQuery;
  quotaId?: string;
  registrationsInclude?: string;
  standaloneEmbedUrl: string;
}): WidgetEmbedSnippetParts {
  const esc = escapeDoubleQuotedAttributeValue;
  const { scriptUrl, chart, standaloneEmbedUrl } = opts;
  const quotaId = opts.quotaId;
  const event = opts.event.trim();
  const registrationsInclude = (opts.registrationsInclude ?? "").trim();
  const includeAttr =
    (chart === "reg-weekly" || chart === "reg-cumulative") && registrationsInclude
      ? ` data-registrations-include="${esc(registrationsInclude)}"`
      : "";
  const openTag =
    quotaId !== undefined && quotaId.length > 0
      ? `<div data-platzmonitor-chart="${chart}" data-event="${esc(event)}"${includeAttr} data-quota-id="${esc(quotaId)}">`
      : `<div data-platzmonitor-chart="${chart}" data-event="${esc(event)}"${includeAttr}>`;
  const scriptLine = `<script src="${esc(scriptUrl)}" defer crossorigin="anonymous"></script>`;
  const noscript = `<noscript><p><a href="${esc(standaloneEmbedUrl)}" target="_blank" rel="noopener noreferrer">Diagramm in neuem Tab</a></p></noscript>`;
  const globalBlock =
    `<!-- Platzmonitor: script-Zeile nur einmal pro Seite -->\n${scriptLine}\n${noscript}\n`;
  const divBlock = `${openTag}</div>\n`;
  const fullCombined =
    `<!-- Platzmonitor: script-Zeile nur einmal pro Seite -->\n${scriptLine}\n${divBlock}${noscript}\n`;
  return { globalBlock, divBlock, fullCombined };
}
