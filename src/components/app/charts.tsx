"use client";

import { useEffect, useRef, useState } from "react";

/** Categorical series colours, fixed order (validated for colour-blind separation; a legend and values always accompany them). */
export const CHART_COLORS = ["#1f8a5b", "#3b78c2", "#b9801a", "#c0522f", "#7a5fb0"] as const;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Whole numbers count up once when they appear. The server renders the final value, so nothing depends on JavaScript. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduced() || value === 0) return;
    const start = performance.now();
    const dur = 800;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown.toLocaleString("en")}</>;
}

/** Tiny trend line for a figure card. Decorative: the card's own number and label carry the meaning. */
export function Sparkline({ values, color = CHART_COLORS[0] }: { values: number[]; color?: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const h = 28;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [values.length < 2 ? 0 : (i / (values.length - 1)) * (w - 6) + 3, h - 4 - (v / max) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const flat = values.every((v) => v === 0);
  return (
    <div ref={ref} aria-hidden="true" className="h-7 w-full">
      {w > 0 ? (
        <svg width={w} height={h} className="block overflow-visible">
          <line x1="0" x2={w} y1={h - 1} y2={h - 1} stroke="var(--color-border)" strokeWidth="1" />
          {!flat ? <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-draw" /> : null}
        </svg>
      ) : null}
    </div>
  );
}

export interface TrendSeries {
  key: string;
  label: string;
  values: number[];
  kind: "money" | "count";
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDayLong = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * One series at a time on a single axis (never two scales): a 2px line over a faint area wash, hairline grid,
 * a crosshair that snaps to the nearest day, and a table view for anyone who prefers numbers.
 */
export function TrendChart({ days, series, currency }: { days: string[]; series: TrendSeries[]; currency: string }) {
  const [active, setActive] = useState(series[0]?.key ?? "");
  const [hover, setHover] = useState<number | null>(null);
  const [ref, w] = useWidth<HTMLDivElement>();
  const s = series.find((x) => x.key === active) ?? series[0];
  if (!s) return null;
  const color = CHART_COLORS[Math.max(0, series.indexOf(s)) % CHART_COLORS.length]!;
  const money = new Intl.NumberFormat("en-LK", { style: "currency", currency, maximumFractionDigits: 0 });
  const fmt = (v: number) => (s.kind === "money" ? money.format(v) : v.toLocaleString("en"));
  const tick = (v: number) => (s.kind === "money" ? compact.format(v) : v.toLocaleString("en"));
  const total = s.values.reduce((a, b) => a + b, 0);

  const h = 224;
  const m = { l: 44, r: 12, t: 12, b: 26 };
  const iw = Math.max(0, w - m.l - m.r);
  const ih = h - m.t - m.b;
  const max = niceMax(Math.max(...s.values));
  const x = (i: number) => m.l + (days.length < 2 ? iw / 2 : (i / (days.length - 1)) * iw);
  const y = (v: number) => m.t + ih - (v / max) * ih;
  const line = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(days.length - 1).toFixed(1)} ${m.t + ih} L${x(0).toFixed(1)} ${m.t + ih} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const xTickEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(iw / 72))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - m.l) / Math.max(1, iw)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  };
  const hi = hover;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted">{s.label}, {fmtDay(days[0]!)} – {fmtDay(days[days.length - 1]!)}</p>
          <p key={s.key} className="chart-fade mt-1 text-[2rem] font-bold leading-none tracking-tight">{fmt(total)}</p>
        </div>
        {series.length > 1 ? (
          <div role="group" aria-label="Series" className="flex flex-wrap gap-1">
            {series.map((x, i) => (
              <button
                key={x.key}
                type="button"
                aria-pressed={x.key === s.key}
                onClick={() => {
                  setActive(x.key);
                  setHover(null);
                }}
                className={"inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors " + (x.key === s.key ? "border-walnut bg-walnut text-ivory" : "border-border bg-surface text-text-muted hover:border-walnut hover:text-text")}
              >
                <span aria-hidden="true" className="h-0.5 w-3" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={ref} className="relative mt-4">
        {w > 0 ? (
          <svg
            key={s.key}
            width={w}
            height={h}
            role="img"
            aria-label={`${s.label}: ${fmt(total)} in total over ${days.length} days, highest ${fmt(Math.max(...s.values))} on a single day.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            className="block touch-pan-y overflow-visible"
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth="1" />
                <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">
                  {tick(t)}
                </text>
              </g>
            ))}
            {days.map((d, i) =>
              i % xTickEvery === 0 ? (
                <text key={d} x={x(i)} y={h - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">
                  {fmtDay(d)}
                </text>
              ) : null,
            )}
            <path d={area} fill={color} opacity="0.1" className="chart-fade" />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="chart-draw" />
            {hi === null ? (
              <circle cx={x(days.length - 1)} cy={y(s.values[days.length - 1]!)} r="4" fill={color} stroke="var(--color-surface)" strokeWidth="2" className="chart-fade" />
            ) : (
              <g>
                <line x1={x(hi)} x2={x(hi)} y1={m.t} y2={m.t + ih} stroke="var(--color-stone)" strokeWidth="1" />
                <circle cx={x(hi)} cy={y(s.values[hi]!)} r="4.5" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
              </g>
            )}
            <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" />
          </svg>
        ) : (
          <div style={{ height: h }} />
        )}
        {hi !== null && w > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-36 border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-md)]"
            style={{ left: Math.min(Math.max(x(hi) + 12, 0), w - 160), top: Math.max(0, y(s.values[hi]!) - 52) }}
          >
            <p className="text-text-muted">{fmtDayLong(days[hi]!)}</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <span aria-hidden="true" className="h-0.5 w-3" style={{ background: color }} />
              {fmt(s.values[hi]!)}
            </p>
          </div>
        ) : null}
      </div>

      <details className="mt-3 text-xs text-text-muted">
        <summary className="cursor-pointer underline decoration-border-strong underline-offset-2">View as table</summary>
        <div className="mt-2 max-h-48 overflow-auto border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-paper-deep">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">Date</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">{s.label}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d} className="border-t border-border">
                  <td className="px-3 py-1.5">{fmtDayLong(d)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(s.values[i]!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Horizontal bars, at most 24px thick, growing from a single baseline. The value sits at the bar tip. */
export function BarChart({ rows, color = CHART_COLORS[0], format = (n: number) => n.toLocaleString("en") }: { rows: { label: string; value: number; hint?: string }[]; color?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3" aria-label="Bar chart">
      {rows.map((r, i) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.hint ? ` (${r.hint})` : ""}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 text-text-muted">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {format(r.value)}
              {r.hint ? <span className="ml-1.5 text-xs font-normal text-text-muted">{r.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 bg-mint">
            <div className="chart-grow h-full origin-left rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, background: color, animationDelay: `${i * 70}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Part-to-whole ring with a 2px surface gap between segments and the total in the middle. Values are also listed beside it. */
export function Donut({ segments, centre, caption, currency }: { segments: { label: string; value: number }[]; centre: string; caption: string; currency?: string }) {
  const format = (n: number) => (currency ? new Intl.NumberFormat("en-LK", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : n.toLocaleString("en"));
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((a, b) => a + b.value, 0);
  const size = 132;
  const r = 52;
  const sw = 16;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${caption}: ${segments.map((s) => `${s.label} ${format(s.value)}`).join(", ")}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-mint)" strokeWidth={sw} />
          {total > 0
            ? segments.map((s, i) => {
                const len = (s.value / total) * c;
                const off = acc;
                acc += len;
                if (s.value <= 0) return null;
                return (
                  <circle
                    key={s.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={hover === i ? sw + 3 : sw}
                    strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                    strokeDashoffset={-off}
                    className="chart-sweep"
                    style={{ animationDelay: `${i * 120}ms`, ["--len" as string]: `${Math.max(0, len - 2)}` }}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                  />
                );
              })
            : null}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <p className="text-xl font-bold leading-none tracking-tight">{hover !== null ? format(segments[hover]!.value) : centre}</p>
          <p className="mt-1 max-w-[5.5rem] text-[0.6875rem] leading-tight text-text-muted">{hover !== null ? segments[hover]!.label : caption}</p>
        </div>
      </div>
      <ul className="min-w-40 flex-1 space-y-2 text-sm">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="size-2.5 shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-text-muted">{s.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
