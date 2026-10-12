import Link from "next/link";
import { asc } from "drizzle-orm";
import { AlertTriangle, CalendarClock, FileText, Hammer, Inbox, ShoppingBag, Users, Wallet } from "lucide-react";
import { BarList, FactList, KpiCard, StackBar } from "@/components/app/dashboard-parts";
import { DashboardView, type SetupCheck } from "@/components/app/dashboard-view";
import { LowStockPanel } from "@/components/app/low-stock-panel";
import { Panel } from "@/components/ui/page-header";
import { can, scopeOf } from "@/lib/auth/permissions";
import { LEAD_STATUS_LABEL, OPEN_LEAD_STATUSES } from "@/lib/crm";
import { getDb } from "@/lib/db/client";
import { locations } from "@/lib/db/schema";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { FLOW, STAGE_LABEL, type JobStage } from "@/lib/production";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";
import { addDaysLocal, formatDate, todayLocal } from "@/lib/time";
import { getSalesDashboard } from "@/server/crm-dashboard";
import { lowStockAlerts } from "@/server/inventory";
import { getFinancialReport, getOwnerDashboard } from "@/server/reports";
import { getWorkshopSummary } from "@/server/production";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const [business, rows] = await Promise.all([
    getBusinessSettings(),
    getDb().select().from(locations).orderBy(asc(locations.name)),
  ]);

  const setup: SetupCheck[] = [
    { label: "Business name", done: !isPlaceholderBusiness(business), hint: "Shown in the website header, quotations and documents." },
    { label: "Showroom address and opening hours", done: Boolean(business.address && business.openingHours), hint: "Shown on the website. The map link appears only once an address exists." },
    { label: "Telephone or WhatsApp number", done: Boolean(business.phone || business.whatsapp), hint: "Used for the contact buttons on the website." },
    { label: "Currency and timezone confirmed", done: false, hint: `Currently assumed: ${business.currency}, ${business.timezone}. Confirm with the owner.` },
  ];

  const isDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const to = isDate(one(sp.to)) ?? todayLocal(business.timezone);
  const from = isDate(one(sp.from)) ?? addDaysLocal(-29, business.timezone);
  const range = from <= to ? { from, to } : { from: to, to: from };
  const money = (v: string) => formatMoney(v, business.currency);

  const kpis: React.ReactNode[] = [];
  const insights: React.ReactNode[] = [];
  const attention: { label: string; value: number | string; href?: string; tone?: "warning" | "danger" }[] = [];

  if (can(actor, "dashboard:sales")) {
    const d = await getSalesDashboard(actor, range);
    kpis.push(
      <KpiCard key="new" icon={Inbox} label="New enquiries" value={d.leads.new} href="/app/leads?status=new" />,
      <KpiCard key="open" icon={Users} label="Open enquiries" value={d.leads.open} sub={`${d.leads.unassignedOpen} unassigned`} href="/app/leads?status=open" />,
      <KpiCard key="fu" icon={CalendarClock} label="Overdue follow-ups" value={d.followUps.overdueMine} sub="Assigned to me" href="/app/follow-ups?status=overdue" tone="danger" />,
      <KpiCard key="quotes" icon={FileText} label="Quotations awaiting reply" value={d.quotations.awaitingCount} sub={`${money(d.quotations.awaitingValue)} outstanding`} href="/app/quotations?status=sent" />,
    );
    const colors = ["bg-brass", "bg-olive", "bg-walnut", "bg-stone", "bg-linen-dark"];
    insights.push(
      <Panel
        key="pipeline"
        title="Enquiry pipeline"
        description={`${d.leads.open} open. ${d.conversion.rate === null ? "No enquiries closed" : `${Math.round(d.conversion.rate * 100)}% won`} (${formatDate(range.from, business.timezone)} – ${formatDate(range.to, business.timezone)}).`}
        actions={<Link className="text-xs underline" href="/app/leads">All enquiries</Link>}
      >
        <StackBar segments={OPEN_LEAD_STATUSES.map((st, i) => ({ label: LEAD_STATUS_LABEL[st], n: d.leads.byStatus[st] ?? 0, color: colors[i % colors.length]! }))} />
      </Panel>,
    );
    attention.push(
      { label: "Unassigned open enquiries", value: d.leads.unassignedOpen, href: "/app/leads?assignedTo=unassigned&status=open", tone: "warning" },
      { label: "Overdue follow-ups (everyone)", value: d.followUps.overdueAll, href: "/app/follow-ups?who=all&status=overdue", tone: "danger" },
      { label: "Quotations past valid-until date", value: d.quotations.pastValidityCount, href: "/app/quotations?status=sent", tone: "warning" },
    );
  }

  if (can(actor, "dashboard:owner")) {
    const o = await getOwnerDashboard(actor, range);
    kpis.push(
      <KpiCard key="orders" icon={ShoppingBag} label="Orders confirmed" value={o.sales.confirmed.count} sub={money(o.sales.confirmed.value)} href="/app/orders" />,
      <KpiCard key="cash" icon={Wallet} label="Cash received" value={money(o.fin.cashReceived)} />,
      <KpiCard key="owed" icon={AlertTriangle} label="Owed by customers" value={money(o.fin.owedByCustomers.value)} sub={`${o.fin.owedByCustomers.count} orders`} href="/app/payments" />,
      <KpiCard key="exp" icon={Wallet} label="Expenses" value={money(o.fin.expenses)} href="/app/expenses" />,
    );
    insights.push(
      <Panel key="money" title="Money in and out" description="Operational cash view, not profit." actions={<Link className="text-xs underline" href={`/app/reports?from=${range.from}&to=${range.to}`}>Reports</Link>}>
        <FactList
          rows={[
            { label: "Cash received", value: money(o.fin.cashReceived) },
            { label: "Expenses", value: money(o.fin.expenses) },
            { label: "Supplier payments", value: money(o.fin.supplierPayments) },
            { label: "Net cash movement", value: money(o.fin.netCashMovement) },
            { label: "Owed to suppliers", value: money(o.fin.owedToSuppliers.value) },
          ]}
        />
      </Panel>,
    );
    attention.push(
      { label: "Overdue workshop jobs", value: o.ops.jobs.overdue, href: "/app/production", tone: "danger" },
      { label: "Deliveries today", value: o.deliveriesToday, href: "/app/deliveries" },
    );
    if (o.ops.afterSales) attention.push({ label: "Overdue after-sales cases", value: o.ops.afterSales.overdue ?? 0, href: "/app/after-sales", tone: "danger" });
    if (o.ops.stock) attention.push({ label: "Low-stock lines", value: o.ops.stock.lowStockLines, href: "/app/stock", tone: "warning" });
  } else if (can(actor, "dashboard:finance")) {
    const fin = await getFinancialReport(actor, range);
    kpis.push(
      <KpiCard key="cash" icon={Wallet} label="Cash received" value={money(fin.cashReceived)} />,
      <KpiCard key="exp" icon={Wallet} label="Expenses" value={money(fin.expenses)} href="/app/expenses" />,
      <KpiCard key="owed" icon={AlertTriangle} label="Owed by customers" value={money(fin.owedByCustomers.value)} sub={`${fin.owedByCustomers.count} orders`} href="/app/payments" />,
      <KpiCard key="owedsup" icon={AlertTriangle} label="Owed to suppliers" value={money(fin.owedToSuppliers.value)} />,
    );
    insights.push(
      <Panel key="money" title="Money in and out" description="Operational cash view, not profit." actions={<Link className="text-xs underline" href={`/app/reports?from=${range.from}&to=${range.to}`}>Full report</Link>}>
        <FactList
          rows={[
            { label: "Cash received", value: money(fin.cashReceived) },
            { label: "Expenses", value: money(fin.expenses) },
            { label: "Supplier payments", value: money(fin.supplierPayments) },
            { label: "Net cash movement", value: money(fin.netCashMovement) },
          ]}
        />
      </Panel>,
    );
  }

  if (can(actor, "production:view")) {
    const w = await getWorkshopSummary(actor);
    const own = scopeOf(actor, "production:view") === "own";
    const stages: JobStage[] = [...FLOW.slice(0, -1), "on_hold"];
    kpis.push(
      <KpiCard key="jobs" icon={Hammer} label={own ? "My active jobs" : "Active jobs"} value={w.active} href="/app/production" />,
      <KpiCard key="late" icon={AlertTriangle} label="Overdue jobs" value={w.overdue} href="/app/production" tone="danger" />,
    );
    insights.push(
      <Panel key="workshop" title={own ? "My jobs" : "Workshop"} description={w.active === 0 ? "No active jobs." : `${w.active} active${w.overdue ? `, ${w.overdue} overdue` : ""}.`} actions={<Link className="text-xs underline" href="/app/production">Open board</Link>}>
        {w.active === 0 ? (
          <p className="text-sm text-text-muted">{own ? "Nothing is assigned to you right now." : "Confirm a custom order to start a job."}</p>
        ) : (
          <BarList rows={stages.filter((st) => w.byStage[st]).map((st) => ({ label: STAGE_LABEL[st], n: w.byStage[st] ?? 0 }))} />
        )}
      </Panel>,
    );
  }

  if (can(actor, "inventory:view") || can(actor, "inventory:view_materials")) {
    const alerts = await lowStockAlerts(actor);
    insights.push(<LowStockPanel key="stock" rows={alerts.map((a) => ({ id: a.id, name: a.name, location: a.location, available: a.available, threshold: a.threshold, unit: a.unit }))} />);
  }

  const flagged = attention.filter((r) => Number(r.value) > 0);
  if (attention.length > 0) {
    insights.splice(
      Math.min(insights.length, 2),
      0,
      <Panel key="attention" title="Needs attention" description={flagged.length === 0 ? "Nothing is overdue or waiting." : `${flagged.length} ${flagged.length === 1 ? "item" : "items"} to look at.`}>
        <FactList rows={attention} />
      </Panel>,
    );
  }

  const dateForm = (
    <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
      <input aria-label="From date" type="date" name="from" defaultValue={range.from} className="h-9 border border-border-strong bg-surface px-2" />
      <span aria-hidden="true" className="text-text-muted">–</span>
      <input aria-label="To date" type="date" name="to" defaultValue={range.to} className="h-9 border border-border-strong bg-surface px-2" />
      <button type="submit" className="h-9 border border-walnut bg-walnut px-3 text-ivory hover:bg-walnut-dark">
        Apply
      </button>
    </form>
  );

  return (
    <DashboardView
      actor={actor}
      setup={setup}
      locations={rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isActive: r.isActive }))}
      kpis={kpis.length > 0 ? kpis.slice(0, kpis.length >= 8 ? 8 : kpis.length >= 4 ? 4 : kpis.length) : undefined}
      insights={insights.length > 0 ? insights : undefined}
      actions={kpis.length > 0 ? dateForm : undefined}
    />
  );
}
