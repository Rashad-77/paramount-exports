import Link from "next/link";
import { Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";

export interface LowStockRow {
  id: string;
  name: string;
  location: string;
  available: string;
  threshold: string;
  unit: string;
}

/** Items whose available stock is at or below the level someone set for that location. */
export function LowStockPanel({ rows, preview = false }: { rows: LowStockRow[]; preview?: boolean }) {
  return (
    <Panel title="Low stock" description="Available stock at or below the level you set for that location.">
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No items are at or below their low-stock level. Set a level on each stock item to be warned.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {rows.slice(0, 8).map((r) => (
            <li key={`${r.id}-${r.location}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <span className="min-w-0">
                {preview ? <span className="font-medium">{r.name}</span> : <Link className="font-medium underline" href={`/app/stock/${r.id}`}>{r.name}</Link>}
                <span className="block text-text-muted">{r.location}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular">{Number(r.available)} {r.unit} left</span>
                <StatusBadge tone="warning">Level {Number(r.threshold)}</StatusBadge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 8 ? <p className="mt-3 text-xs text-text-muted">…and {rows.length - 8} more.</p> : null}
    </Panel>
  );
}
