import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp, Sparkline } from "@/components/app/charts";
import { StatusBadge } from "@/components/ui/status";

/** One headline figure: icon and label, the number, a short context line and (optionally) its daily trend. A whole card links when `href` is given. */
export function KpiCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone,
  trend,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  href?: string;
  icon: LucideIcon;
  tone?: "warning" | "danger";
  trend?: number[] | null;
}) {
  const flagged = tone && Number(value) > 0;
  return (
    <div className={"relative flex min-w-0 flex-col border bg-surface p-4 shadow-[var(--shadow-sm)] transition-colors " + (href ? "hover:border-green " : "") + (flagged && tone === "danger" ? "border-danger/40" : "border-border")}>
      <div className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center bg-green-soft text-green-text">
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
      <p className={"mt-2.5 font-bold tracking-tight leading-none " + (typeof value === "number" ? "text-[1.75rem]" : String(value).length > 9 ? "text-xl" : "text-[1.75rem]")}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </p>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-text-muted">
        {sub ? <span>{sub}</span> : null}
        {flagged ? <StatusBadge tone={tone}>{tone === "danger" ? "Needs attention" : "Check"}</StatusBadge> : null}
      </div>
      {trend ? (
        <div className="mt-2">
          <Sparkline values={trend} />
        </div>
      ) : null}
    </div>
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
