import type { ReactNode } from "react";
import { Panel } from "@/components/ui/page-header";

/** One figure with its label. Always inside a <dl> via <Metrics>. */
export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 p-2">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="tabular mt-0.5 break-words text-xl font-semibold">
        {value}
        {hint ? <span className="mt-0.5 block text-xs font-normal text-text-muted">{hint}</span> : null}
      </dd>
    </div>
  );
}

export function Metrics({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const grid = cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return <dl className={`grid grid-cols-1 gap-2 ${grid}`}>{children}</dl>;
}

export function Definitions({ items }: { items: string[] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer font-medium underline">How these figures are worked out</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
        {items.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </details>
  );
}

export function ReportSection({ title, description, exports, children }: { title: string; description?: string; exports?: ReactNode; children: ReactNode }) {
  return (
    <Panel title={title} description={description} actions={exports}>
      {children}
    </Panel>
  );
}
