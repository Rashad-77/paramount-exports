import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { SalesDashboard } from "@/server/crm-dashboard";

function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "danger" | "warning" }) {
  const long = String(value).length > 9; // money amounts and phrases get a smaller size so they never collide with the next stat
  const body = (
    <>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className={"tabular mt-0.5 flex flex-wrap items-center gap-x-2 font-semibold break-words " + (long ? "text-lg" : "text-2xl")}>
        {value}
        {tone && Number(value) > 0 ? <StatusBadge tone={tone}>{tone === "danger" ? "Needs attention" : "Check"}</StatusBadge> : null}
      </dd>
    </>
  );
  return href ? (
    <Link href={href} className="block min-w-0 rounded-[var(--radius-md)] p-2 hover:bg-linen">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 p-2">{body}</div>
  );
}

export function SalesMetrics({ d, currency, timezone, preview = false }: { d: SalesDashboard; currency: string; timezone: string; preview?: boolean }) {
  const link = (p: string) => (preview ? undefined : p);
  return (
    <>
      <Panel title="Enquiries">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="New" value={d.leads.new} href={link("/app/leads?status=new")} />
          <Stat label="Open, unassigned" value={d.leads.unassignedOpen} href={link("/app/leads?assignedTo=unassigned&status=open")} tone="warning" />
          <Stat label="Open in total" value={d.leads.open} href={link("/app/leads?status=open")} />
        </dl>
      </Panel>
      <Panel title="Follow-ups">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Overdue (mine)" value={d.followUps.overdueMine} href={link("/app/follow-ups?status=overdue")} tone="danger" />
          <Stat label="Due today (mine)" value={d.followUps.dueTodayMine} href={link("/app/follow-ups")} />
          <Stat label="Overdue (everyone)" value={d.followUps.overdueAll} href={link("/app/follow-ups?who=all&status=overdue")} />
        </dl>
      </Panel>
      <Panel title="Quotations awaiting a reply" description="Value shown is what is outstanding, not revenue. Only accepted and delivered work counts as sales.">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Sent, awaiting reply" value={d.quotations.awaitingCount} href={link("/app/quotations?status=sent")} />
          <Stat label="Outstanding value" value={formatMoney(d.quotations.awaitingValue, currency)} />
          <Stat label="Past valid-until date" value={d.quotations.pastValidityCount} tone="warning" />
        </dl>
      </Panel>
      <Panel title="Conversion" description="Enquiries won ÷ (won + lost), counting those closed within the dates. Quotation values are never added to revenue.">
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <TextField label="From" name="from" type="date" showOptional={false} defaultValue={d.range.from} />
          <TextField label="To" name="to" type="date" showOptional={false} defaultValue={d.range.to} />
          <Button type="submit" variant="secondary">Apply dates</Button>
        </form>
        <p className="mb-2 text-xs text-text-muted">
          {formatDate(d.range.from, timezone)} – {formatDate(d.range.to, timezone)}
        </p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Enquiries received" value={d.conversion.created} />
          <Stat label="Won" value={d.conversion.won} />
          <Stat label="Lost" value={d.conversion.lost} />
          <Stat label="Conversion rate" value={d.conversion.rate === null ? "No closed enquiries" : `${Math.round(d.conversion.rate * 100)}%`} />
        </dl>
      </Panel>
    </>
  );
}
