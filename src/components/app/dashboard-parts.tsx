import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/status";

/** One headline figure: small icon + label, big number, a short context line. A whole card links when `href` is given. */
export function KpiCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
  icon: LucideIcon;
  tone?: "warning" | "danger";
}) {
  const flagged = tone && Number(value) > 0;
  return (
    <div className={"relative min-w-0 border bg-surface p-4 shadow-[var(--shadow-sm)] " + (href ? "transition-colors hover:border-walnut " : "") + (flagged && tone === "danger" ? "border-danger/40" : "border-border")}>
      <div className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center bg-linen text-walnut">
          <Icon className="size-3.5" strokeWidth={1.75} />
        </span>
        {href ? (
          <Link href={href} className="truncate after:absolute after:inset-0 after:content-['']">
            {label}
          </Link>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </div>
      <p className={"mt-2.5 font-semibold tabular-nums leading-none " + (String(value).length > 9 ? "text-xl" : "text-[1.75rem]")}>{value}</p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-text-muted">
        {sub ? <span>{sub}</span> : null}
        {flagged ? <StatusBadge tone={tone}>{tone === "danger" ? "Needs attention" : "Check"}</StatusBadge> : null}
      </div>
    </div>
  );
}

export interface Segment {
  label: string;
  n: number;
  /** A Tailwind background class. */
  color: string;
}

/** Share of a whole as one bar, with a legend that also states the numbers (colour is never the only cue). */
export function StackBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.n, 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden bg-linen" role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(", ")}>
        {total > 0 ? segments.filter((s) => s.n > 0).map((s) => <span key={s.label} className={s.color} style={{ width: `${(s.n / total) * 100}%` }} />) : null}
      </div>
      <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className={"size-2.5 shrink-0 self-start mt-1.5 " + s.color} />
              <span className="text-text-muted">{s.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{s.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Labelled horizontal bars, each scaled against the largest value. */
export function BarList({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-3 text-sm">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-text-muted">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.n}</span>
          </div>
          <div className="mt-1 h-1.5 bg-linen">
            <div className="h-full bg-brass" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A label with its value on the right, one row per fact. */
export function FactList({ rows }: { rows: { label: string; value: ReactNode; href?: string; tone?: "warning" | "danger" }[] }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <dt className="min-w-0 text-text-muted">
            {r.href ? (
              <Link href={r.href} className="underline decoration-border-strong underline-offset-2 hover:text-text">
                {r.label}
              </Link>
            ) : (
              r.label
            )}
          </dt>
          <dd className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">
            {r.value}
            {r.tone && Number(r.value) > 0 ? <StatusBadge tone={r.tone}>{r.tone === "danger" ? "Overdue" : "Check"}</StatusBadge> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
