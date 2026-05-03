import { useEffect, useId, useRef, useState } from 'react';

export type ChartPoint = { x: number; y: number };

export type LineSeries = {
  id: string;
  label: string;
  emphasize?: boolean;
  dashed?: boolean;
  /** Linienopazität 0…1, Vorgabe 1. */
  strokeOpacity?: number;
  /** Serie von Hover-Treffer und Fokus-Dimmung ausnehmen (z. B. Hilfslinien). */
  omitFromHover?: boolean;
  color: string;
  points: ChartPoint[];
};

type Props = {
  series: LineSeries[];
  width?: number;
  height?: number;
  /** Callback, sobald Hover im Plot beginnt oder endet. */
  onPlotHoverChange?: (hovering: boolean) => void;
  xLabel?: string;
  yLabel?: string;
  /** X-Wert im Hover-Tooltip als Text. */
  formatX?: (x: number) => string;
  /** X-Werte an der unteren Achse (Vorgabe wie formatX). */
  formatXTick?: (x: number) => string;
  /** Y-Werte im Tooltip und an der linken Achse. */
  formatY?: (y: number) => string;
  /** Zweite Tooltip-Zeile unter dem Kurvennamen. */
  formatHoverBody?: (xData: number, yData: number) => string;
  /** X-Richtung: große Werte links, kleinere rechts. */
  invertX?: boolean;
  padL?: number;
  padR?: number;
  padT?: number;
  padB?: number;
  /** Max. Abstand Maus–Kurve in SVG-Pixeln für Snap, Tooltip und Serienfokus. */
  hoverSnapMaxDySvg?: number;
  /** Tooltip-X am nächsten Messpunkt statt interpoliert auf der Linie. */
  hoverSnapToNearestX?: boolean;
  /** Klick wählt eine Serie zum Fokus; Klick ins Leere hebt auf. */
  selectableSeries?: boolean;
};

/** Vorgabe für hoverSnapMaxDySvg (Hover nahe an der Linie). */
const DEFAULT_HOVER_SNAP_MAX_DY_SVG = 22;

/** Client-Koordinaten in SVG-ViewBox-Koordinaten (Zoom/CSS berücksichtigt). */
function clientToSvgPx(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const vb = svg.viewBox.baseVal;
  const svgW = vb.width;
  const svgH = vb.height;
  const p = svg.createSVGPoint();
  p.x = clientX;
  p.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    const br = svg.getBoundingClientRect();
    return {
      x: ((clientX - br.left) / Math.max(br.width, 1e-9)) * svgW,
      y: ((clientY - br.top) / Math.max(br.height, 1e-9)) * svgH,
    };
  }
  const l = p.matrixTransform(ctm.inverse());
  return { x: l.x, y: l.y };
}

/** Linear interpolierter Y-Wert zu dataX innerhalb der Stützstellen, sonst null. */
function interpolatedY(points: ChartPoint[], dataX: number, xEpsilon: number): number | null {
  if (points.length === 0) {
    return null;
  }
  const pts = [...points].sort((a, b) => a.x - b.x);
  const xMin = pts[0].x;
  const xMax = pts[pts.length - 1].x;
  if (dataX < xMin - xEpsilon || dataX > xMax + xEpsilon) {
    return null;
  }
  if (pts.length === 1) {
    return Math.abs(pts[0].x - dataX) <= xEpsilon ? pts[0].y : null;
  }
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const lo = Math.min(p0.x, p1.x);
    const hi = Math.max(p0.x, p1.x);
    if (dataX < lo - xEpsilon || dataX > hi + xEpsilon) {
      continue;
    }
    const dx = p1.x - p0.x;
    if (Math.abs(dx) < xEpsilon) {
      return (p0.y + p1.y) / 2;
    }
    const t = (dataX - p0.x) / dx;
    return p0.y + Math.max(0, Math.min(1, t)) * (p1.y - p0.y);
  }
  return null;
}

/** Messpunkt mit minimalem |x − probeX|. */
function nearestPointByX(points: ChartPoint[], probeX: number): ChartPoint | null {
  if (points.length === 0) {
    return null;
  }
  let best = points[0];
  let bestD = Math.abs(best.x - probeX);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const d = Math.abs(p.x - probeX);
    if (d < bestD - 1e-12 || (Math.abs(d - bestD) <= 1e-12 && p.x > best.x)) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Serien mit Hover-Treffern (ohne `omitFromHover`). */
function hoverableSeries(seriesArr: LineSeries[]): LineSeries[] {
  return seriesArr.filter((s) => !s.omitFromHover);
}

/** Treffer: bei Maus-x die Serie mit kleinstem vertikalen Abstand zur Kurve innerhalb maxDySvg. */
function hitAlongVerticalSlice(
  seriesArr: LineSeries[],
  mxPlot: number,
  myPlot: number,
  axisXmin: number,
  axisXmax: number,
  xRange: number,
  invertX: boolean,
  padL: number,
  innerW: number,
  xScale: (x: number) => number,
  yScale: (y: number) => number,
  maxDySvg: number,
  hoverSnapToNearestX: boolean
): { s: LineSeries; xData: number; yData: number; px: number; py: number } | null {
  const fracUnc = innerW > 1e-9 ? (mxPlot - padL) / innerW : 0.5;
  const frac = Math.max(0, Math.min(1, fracUnc));
  const raw =
    invertX ? axisXmax - frac * xRange : axisXmin + frac * xRange;
  const xData = Math.max(axisXmin, Math.min(axisXmax, raw));
  const xPx = xScale(xData);
  const xEps = Math.max(1e-9 * xRange, Number.EPSILON * (Math.abs(axisXmax) + Math.abs(axisXmin) + 1));

  let best: { s: LineSeries; xData: number; yData: number; px: number; py: number; dy: number } | null =
    null;

  for (const s of hoverableSeries(seriesArr)) {
    const yInterp = interpolatedY(s.points, xData, xEps);
    if (yInterp === null) {
      continue;
    }
    let yOut = yInterp;
    let xOut = xData;
    if (hoverSnapToNearestX && s.points.length > 0) {
      const np = nearestPointByX(s.points, xData);
      if (np !== null) {
        yOut = np.y;
        xOut = np.x;
      }
    }
    const yPx = yScale(yOut);
    const xPxNearest = hoverSnapToNearestX ? xScale(xOut) : xPx;
    const dy = Math.abs(myPlot - yPx);
    if (best === null || dy < best.dy) {
      best = { s, xData: xOut, yData: yOut, px: xPxNearest, py: yPx, dy };
    }
  }
  if (best === null || best.dy > maxDySvg) {
    return null;
  }
  return {
    s: best.s,
    xData: best.xData,
    yData: best.yData,
    px: best.px,
    py: best.py,
  };
}

function defaultFormatY(y: number): string {
  if (!Number.isFinite(y)) {
    return '';
  }
  const abs = Math.abs(y);
  const maxFrac = abs >= 100 || abs % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: maxFrac }).format(y);
}

function defaultFormatX(x: number): string {
  if (!Number.isFinite(x)) {
    return '';
  }
  const abs = Math.abs(x);
  const maxFrac = abs >= 100 || abs % 1 === 0 ? 0 : 2;
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: maxFrac }).format(x);
}

/** Rasterschritt ≈ 1, 2 oder 5 · 10^n. */
function niceTickStep(approxStep: number): number {
  if (!(approxStep > 1e-12) || !Number.isFinite(approxStep)) {
    return 1;
  }
  const exp = Math.floor(Math.log10(approxStep));
  const frac = approxStep / 10 ** exp;
  let m: number;
  if (frac <= 1) {
    m = 1;
  } else if (frac <= 2) {
    m = 2;
  } else if (frac <= 5) {
    m = 5;
  } else {
    m = 10;
  }
  return m * 10 ** exp;
}

/** Gleichmäßig verteilte Y-Tick-Werte von lo bis hi (höchstens etwa maxTicks Schritte). */
function niceLinearTicks(lo: number, hi: number, maxTicks = 9): number[] {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return [0, 2, 4, 6, 8, 10];
  }
  const span = b - a;
  if (!(span > 1e-12 * Math.max(1, Math.abs(b)))) {
    const stepD = niceTickStep(Math.max(Math.abs(b) * 0.35, 3));
    const out: number[] = [];
    for (let i = 0; i <= 5; i++) {
      out.push(+(a + i * stepD).toPrecision(12));
    }
    return out;
  }
  const divisions = Math.max(maxTicks - 1, 2);
  const step = niceTickStep(span / divisions);
  let tickLo = Math.floor(a / step) * step;
  if (a >= 0 && tickLo < 0) {
    tickLo = 0;
  }
  let tickHi = Math.ceil(b / step) * step;
  while (tickHi < b - 1e-9) {
    tickHi += step;
  }
  const segCount = Math.min(80, Math.max(1, Math.round((tickHi - tickLo) / step)));
  const ticks: number[] = [];
  for (let i = 0; i <= segCount; i++) {
    let v = tickLo + i * step;
    v = step >= 1 ? Math.round(v / step) * step : +v.toPrecision(12);
    ticks.push(v);
  }
  return ticks.length > 0 ? ticks : [a, b];
}

/** Tooltip horizontal mittig unter dem Punkt, Randabstand zur Plotbreite. */
function tooltipDockCenterPercent(args: {
  hxSvg: number;
  svgVBWidth: number;
  plotClientPx: number;
  rootRemPx: number;
}): number {
  const plot = Math.max(args.plotClientPx, 1);
  const hxPx = (args.hxSvg / Math.max(args.svgVBWidth, 1)) * plot;
  const gutter = 4;
  const maxWt = Math.min(16 * args.rootRemPx, plot * 0.92);
  const leftLim = gutter + maxWt / 2;
  const rightLim = plot - gutter - maxWt / 2;
  if (!(leftLim < rightLim)) {
    return 50;
  }
  const cx = Math.min(rightLim, Math.max(leftLim, hxPx));
  return (cx / plot) * 100;
}

export function LineChart({
  series,
  width = 640,
  height = 340,
  xLabel,
  yLabel,
  formatX = defaultFormatX,
  formatXTick,
  formatY = defaultFormatY,
  formatHoverBody,
  invertX = false,
  padL = 56,
  padR = 28,
  padT = 22,
  padB = 56,
  onPlotHoverChange,
  hoverSnapMaxDySvg = DEFAULT_HOVER_SNAP_MAX_DY_SVG,
  hoverSnapToNearestX = false,
  selectableSeries = false,
}: Props) {
  const xAxisCaptionClipId = `lf-xcap-${useId().replace(/\W/g, '')}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const formatTickX = formatXTick ?? formatX;
  const [pinnedSeriesId, setPinnedSeriesId] = useState<string | null>(null);
  const effectivePinnedSeriesId =
    pinnedSeriesId !== null && series.some((s) => s.id === pinnedSeriesId)
      ? pinnedSeriesId
      : null;

  const [hover, setHover] = useState<{
    seriesId: string;
    label: string;
    color: string;
    hx: number;
    hy: number;
    dockLeftPct: number;
    bodyLine?: string;
    fx?: string;
    fy?: string;
  } | null>(null);

  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      xmin = Math.min(xmin, p.x);
      xmax = Math.max(xmax, p.x);
      ymax = Math.max(ymax, p.y);
      ymin = Math.min(ymin, p.y);
    }
  }

  if (!Number.isFinite(ymin)) {
    ymin = 0;
  }
  if (!Number.isFinite(ymax)) {
    ymax = 0;
  }

  if (!Number.isFinite(xmin) || !Number.isFinite(xmax)) {
    xmin = 0;
    xmax = 1;
  }

  let axisXmin = xmin;
  const axisXmax = xmax;
  if (invertX) {
    axisXmin = Math.min(0, xmin);
  }

  const xRange = Math.max(axisXmax - axisXmin, 1e-6);

  const yBaseline = ymin < 0 ? ymin : 0;
  const spanYdat = ymax - yBaseline;

  if (!(spanYdat > 0)) {
    ymax = yBaseline >= 0 ? 10 : yBaseline + Math.max(-yBaseline * 0.05, 8);
  } else {
    const pct = spanYdat * 0.05;
    const minExtra = spanYdat < 80 ? 2 + spanYdat * 0.02 : 4 + spanYdat * 0.012;
    ymax = ymax + Math.max(pct, minExtra);
  }
  const y0 = ymin < 0 ? ymin : 0;

  const yTickVals = niceLinearTicks(y0, ymax, 9);
  const yPlotMin = yTickVals[0];
  const yPlotMax = yTickVals[yTickVals.length - 1];
  const ySpanPlot = Math.max(yPlotMax - yPlotMin, 1e-12);

  const xTickVals = niceLinearTicks(axisXmin, axisXmax, 9);

  const xScale = (x: number): number =>
    invertX
      ? padL + ((axisXmax - x) / xRange) * innerW
      : padL + ((x - axisXmin) / xRange) * innerW;
  const yScale = (y: number): number =>
    padT + innerH - ((y - yPlotMin) / ySpanPlot) * innerH;

  const lastReportedHover = useRef<boolean | null>(null);
  useEffect(() => {
    if (onPlotHoverChange === undefined) {
      return;
    }
    const hovering = hover !== null;
    if (lastReportedHover.current !== hovering) {
      lastReportedHover.current = hovering;
      onPlotHoverChange(hovering);
    }
  }, [hover, onPlotHoverChange]);

  function tooltipDockLeftPercentForHx(hxSvg: number): number {
    let plotPx = width;
    const svgEl = svgRef.current;
    if (svgEl !== null) {
      const cw = svgEl.getBoundingClientRect().width;
      if (cw > 0) {
        plotPx = cw;
      }
    }
    const rootRemPx =
      typeof document !== "undefined"
        ? parseFloat(getComputedStyle(document.documentElement).fontSize || "16")
        : 16;
    return tooltipDockCenterPercent({
      hxSvg,
      svgVBWidth: width,
      plotClientPx: plotPx,
      rootRemPx,
    });
  }

  function clearHover() {
    setHover(null);
  }

  function applyHitToHoverState(hit: {
    s: LineSeries;
    xData: number;
    yData: number;
    px: number;
    py: number;
  }): void {
    const dockLeftPct = tooltipDockLeftPercentForHx(hit.px);
    setHover(
      formatHoverBody !== undefined
        ? {
          seriesId: hit.s.id,
          label: hit.s.label,
          color: hit.s.color,
          bodyLine: formatHoverBody(hit.xData, hit.yData),
          hx: hit.px,
          hy: hit.py,
          dockLeftPct,
        }
        : {
          seriesId: hit.s.id,
          label: hit.s.label,
          color: hit.s.color,
          fx: formatX(hit.xData),
          fy: formatY(hit.yData),
          hx: hit.px,
          hy: hit.py,
          dockLeftPct,
        }
    );
  }

  function hitForPointer(mx: number, my: number, maxDy: number, restrictToPinned: boolean) {
    const candidates = restrictToPinned
      ? hoverableSeries(series).filter((s) => s.id === effectivePinnedSeriesId)
      : hoverableSeries(series);
    if (candidates.length === 0) {
      return null;
    }
    return hitAlongVerticalSlice(
      candidates,
      mx,
      my,
      axisXmin,
      axisXmax,
      xRange,
      invertX,
      padL,
      innerW,
      xScale,
      yScale,
      maxDy,
      hoverSnapToNearestX
    );
  }

  function onOverlayMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (svg === null) {
      return;
    }
    const { x: mx, y: my } = clientToSvgPx(svg, e.clientX, e.clientY);

    const maxDy =
      selectableSeries && effectivePinnedSeriesId !== null
        ? Number.POSITIVE_INFINITY
        : hoverSnapMaxDySvg;
    const hit = hitForPointer(mx, my, maxDy, Boolean(selectableSeries && effectivePinnedSeriesId !== null));
    if (hit === null) {
      setHover(null);
      return;
    }
    applyHitToHoverState(hit);
  }

  function onOverlayPointerDown(e: React.PointerEvent<SVGRectElement>) {
    if (!selectableSeries) {
      return;
    }
    e.preventDefault();
    const svg = svgRef.current;
    if (svg === null) {
      return;
    }
    const { x: mx, y: my } = clientToSvgPx(svg, e.clientX, e.clientY);

    const hitSel = hitForPointer(mx, my, hoverSnapMaxDySvg, false);
    const nextPinned = hitSel?.s.id ?? null;
    setPinnedSeriesId(nextPinned);
    if (nextPinned !== null && hitSel !== null) {
      applyHitToHoverState(hitSel);
    } else {
      setHover(null);
    }
  }

  const svgAriaParts = [xLabel, yLabel].filter((s): s is string => Boolean(s));
  const svgAriaLabel =
    svgAriaParts.length > 0
      ? `${svgAriaParts.join(', ')}. Liniendiagramm, Maus zeigt Werte${selectableSeries ? ', Klick wählt eine Kurve aus' : ''}.`
      : `Liniendiagramm, Maus zeigt Werte${selectableSeries ? ', Klick wählt eine Kurve aus' : ''}.`;

  return (
    <div className="line-chart-wrap">
      <div className="line-chart-plot">
        <svg
          ref={svgRef}
          className="line-chart"
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ aspectRatio: `${String(width)} / ${String(height)}` }}
          role="img"
          aria-label={svgAriaLabel}
        >
          <defs>
            <clipPath id={xAxisCaptionClipId}>
              <rect
                x={padL}
                y={height - padB - 4}
                width={innerW + padR}
                height={padB + 8}
              />
            </clipPath>
          </defs>
          {yTickVals.map((yVal, yi) => {
            const yPx = yScale(yVal);
            return (
              <g key={`h-${String(yi)}`}>
                <line
                  className="line-chart__grid"
                  x1={padL}
                  x2={width - padR}
                  y1={yPx}
                  y2={yPx}
                />
              </g>
            );
          })}

          {xTickVals.map((xv, vi) => {
            const xPx = xScale(xv);
            return (
              <line
                key={`v-${String(vi)}`}
                className="line-chart__grid line-chart__grid--vert"
                x1={xPx}
                x2={xPx}
                y1={padT}
                y2={padT + innerH}
              />
            );
          })}

          <rect
            className={selectableSeries ? 'line-chart__hit line-chart__hit--selectable' : 'line-chart__hit'}
            x={padL}
            y={padT}
            width={innerW}
            height={innerH}
            fill="transparent"
            pointerEvents="all"
            style={{
              cursor: hover !== null || (selectableSeries && effectivePinnedSeriesId !== null) ? 'crosshair' : 'default',
              touchAction: selectableSeries ? 'none' : undefined,
            }}
            onPointerDown={onOverlayPointerDown}
            onMouseMove={onOverlayMove}
            onMouseLeave={clearHover}
          />

          {(() => {
            const focusId = hover?.seriesId ?? effectivePinnedSeriesId;
            const sorted =
              focusId !== null
                ? [...series].sort((a, b) => {
                  const af = a.id === focusId ? 1 : 0;
                  const bf = b.id === focusId ? 1 : 0;
                  return af - bf;
                })
                : series;
            return sorted;
          })().map((s) => {
            if (s.points.length === 0) {
              return null;
            }
            const pts = s.points.map((p) => `${String(xScale(p.x))},${String(yScale(p.y))}`).join(' ');
            const d = `M ${pts}`;
            const baseSw = s.emphasize ? 3.2 : 1.7;
            const focusId = hover?.seriesId ?? effectivePinnedSeriesId;
            const isHit = focusId !== null && s.id === focusId;
            const isDimmed = focusId !== null && !isHit;
            const sw = isHit ? baseSw + 1.75 : baseSw;
            const opacity =
              (isDimmed ? 0.22 : isHit ? 1 : 0.95) * (s.strokeOpacity ?? 1);
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={sw}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? '5 6' : undefined}
                opacity={opacity}
              />
            );
          })}

          {yTickVals.map((yVal, yi) => {
            const yPx = yScale(yVal);
            return (
              <text
                key={`yt-${String(yi)}`}
                className="line-chart__tick"
                x={padL - 8}
                y={yPx + 4}
                textAnchor="end"
                fontSize="11"
              >
                {formatY(yVal)}
              </text>
            );
          })}

          <g clipPath={`url(#${xAxisCaptionClipId})`}>
            {xTickVals.map((xv, ti) => {
              const tx = xScale(xv);
              return (
                <text
                  key={`xt-${String(ti)}`}
                  className="line-chart__tick"
                  x={tx}
                  y={height - 28}
                  textAnchor="middle"
                  fontSize="11"
                >
                  {formatTickX(xv)}
                </text>
              );
            })}

            {xLabel !== undefined ? (
              <text
                className="line-chart__label line-chart__label--axis"
                x={padL + innerW / 2}
                y={height - 10}
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
              >
                {xLabel}
              </text>
            ) : null}
          </g>

          {yLabel !== undefined ? (
            <text
              className="line-chart__label line-chart__label--axis"
              x={14}
              y={padT + innerH / 2}
              textAnchor="middle"
              fontSize="12"
              fill="currentColor"
              transform={`rotate(-90 14 ${String(padT + innerH / 2)})`}
            >
              {yLabel}
            </text>
          ) : null}

          {hover !== null ? (
            <line
              className="line-chart__vline"
              x1={hover.hx}
              x2={hover.hx}
              y1={padT}
              y2={padT + innerH}
            />
          ) : null}
          {hover !== null ? (
            <circle cx={hover.hx} cy={hover.hy} r={6} fill={hover.color} opacity={0.35} stroke="none" />
          ) : null}
          {hover !== null ? (
            <circle
              cx={hover.hx}
              cy={hover.hy}
              r={4}
              fill="var(--surface, #fff)"
              stroke={hover.color}
              strokeWidth={2}
            />
          ) : null}
        </svg>

        {hover !== null ? (
          <div
            className="line-chart__tooltip line-chart__tooltip--dock"
            role="status"
            style={{ left: `${String(hover.dockLeftPct)}%` }}
          >
            <div className="line-chart__tooltip-title">{hover.label}</div>
            {hover.bodyLine !== undefined ? (
              <div>{hover.bodyLine}</div>
            ) : (
              <>
                <div>x: {hover.fx ?? ''}</div>
                <div>y: {hover.fy ?? ''}</div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
