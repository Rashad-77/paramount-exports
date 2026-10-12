import Link from "next/link";
import { asc } from "drizzle-orm";
import { AlertTriangle, CalendarClock, FileText, Hammer, Inbox, Receipt, ShoppingBag, Users, Wallet } from "lucide-react";
import { BarChart, Donut, TrendChart, type TrendSeries } from "@/components/app/charts";
import { FactList, KpiCard } from "@/components/app/dashboard-parts";
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
import { getDashboardCharts } from "@/server/dashboard-charts";
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
  const moneyN = (n: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: business.currency, maximumFractionDigits: 0 }).format(n);

  const sales = can(actor, "dashboard:sales") ? await getSalesDashboard(actor, range) : null;
  const owner = can(actor, "dashboard:owner") ? await getOwnerDashboard(actor, range) : null;
  const fin = !owner && can(actor, "dashboard:finance") ? await getFinancialReport(actor, range) : null;
  const work = can(actor, "production:view") ? await getWorkshopSummary(actor) : null;
  const own = scopeOf(actor, "production:view") === "own";
  const stock = can(actor, "inventory:view") || can(actor, "inventory:view_materials") ? await lowStockAlerts(actor) : null;
  const ch = await getDashboardCharts(actor, range);

  const kpis: React.ReactNode[] = [];
  if (sales) {
    kpis.push(
      <KpiCard key="new" icon={Inbox} label="New enquiries" value={sales.leads.new} href="/app/leads?status=new" trend={ch.enquiries} />,
      <KpiCard key="open" icon={Users} label="Open enquiries" value={sales.leads.open} sub={`${sales.leads.unassignedOpen} unassigned`} href="/app/leads?status=open" />,
      <KpiCard key="fu" icon={CalendarClock} label="Overdue follow-ups" value={sales.followUps.overdueMine} sub="Assigned to me" href="/app/follow-ups?status=overdue" tone="danger" />,
      <KpiCard key="quotes" icon={FileText} label="Quotations awaiting reply" value={sales.quotations.awaitingCount} sub={`${money(sales.quotations.awaitingValue)} outstanding`} href="/app/quotations?status=sent" />,
    );
  }
  if (owner) {
    kpis.push(
      <KpiCard key="orders" icon={ShoppingBag} label="Orders confirmed" value={owner.sales.confirmed.count} sub={money(owner.sales.confirmed.value)} href="/app/orders" trend={ch.orderCount} />,
      <KpiCard key="cash" icon={Wallet} label="Cash received" value={money(owner.fin.cashReceived)} trend={ch.cash} />,
      <KpiCard key="owed" icon={AlertTriangle} label="Owed by customers" value={money(owner.fin.owedByCustomers.value)} sub={`${owner.fin.owedByCustomers.count} orders`} href="/app/payments" />,
      <KpiCard key="exp" icon={Receipt} label="Expenses" value={money(owner.fin.expenses)} href="/app/expenses" trend={ch.expenses} />,
    );
  } else if (fin) {
    kpis.push(
      <KpiCard key="cash" icon={Wallet} label="Cash received" value={money(fin.cashReceived)} trend={ch.cash} />,
      <KpiCard key="exp" icon={Receipt} label="Expenses" value={money(fin.expenses)} href="/app/expenses" trend={ch.expenses} />,
      <KpiCard key="owed" icon={AlertTriangle} label="Owed by customers" value={money(fin.owedByCustomers.value)} sub={`${fin.owedByCustomers.count} orders`} href="/app/payments" />,
      <KpiCard key="owedsup" icon={AlertTriangle} label="Owed to suppliers" value={money(fin.owedToSuppliers.value)} />,
    );
  }
  if (work) {
    kpis.push(
      <KpiCard key="jobs" icon={Hammer} label={own ? "My active jobs" : "Active jobs"} value={work.active} href="/app/production" />,
      <KpiCard key="late" icon={AlertTriangle} label="Overdue jobs" value={work.overdue} href="/app/production" tone="danger" />,
    );
  }

  // Row 1: the daily trend, beside the current order pipeline.
  const series: TrendSeries[] = [];
  if (ch.orderValue) series.push({ key: "orders", label: "Order value", values: ch.orderValue, kind: "money" });
  if (ch.cash) series.push({ key: "cash", label: "Cash received", values: ch.cash, kind: "money" });
  if (ch.expenses) series.push({ key: "expenses", label: "Expenses", values: ch.expenses, kind: "money" });
  if (ch.enquiries) series.push({ key: "enquiries", label: "Enquiries received", values: ch.enquiries, kind: "count" });
  const rowOne: React.ReactNode[] = [];
  if (series.length > 0) {
    rowOne.push(
      <div key="trend" className={ch.ordersByStatus ? "lg:col-span-2" : "lg:col-span-3"}>
        <Panel title="Daily trend" description={`${formatDate(range.from, business.timezone)} – ${formatDate(range.to, business.timezone)}. One measure at a time.`}>
          <TrendChart days={ch.days} series={series} currency={business.currency} />
        </Panel>
      </div>,
    );
  }
  if (ch.ordersByStatus) {
    const total = ch.ordersByStatus.reduce((a, b) => a + b.n, 0);
    rowOne.push(
      <Panel key="status" title="Orders by status" description="Every confirmed order, as it stands today." actions={<Link className="text-xs underline" href="/app/orders">All orders</Link>}>
        <Donut segments={ch.ordersByStatus.map((r) => ({ label: r.label, value: r.n }))} centre={String(total)} caption={total === 1 ? "order" : "orders"} />
      </Panel>,
    );
  }

  // Row 2: where enquiries are, where jobs are, where the spending goes.
  const rowTwo: React.ReactNode[] = [];
  if (sales) {
    rowTwo.push(
      <Panel key="funnel" title="Enquiries by stage" description={`${sales.leads.open} open. ${sales.conversion.rate === null ? "None closed in these dates." : `${Math.round(sales.conversion.rate * 100)}% of closed enquiries won.`}`} actions={<Link className="text-xs underline" href="/app/leads">All enquiries</Link>}>
        <BarChart rows={OPEN_LEAD_STATUSES.map((st) => ({ label: LEAD_STATUS_LABEL[st], value: sales.leads.byStatus[st] ?? 0 }))} />
      </Panel>,
    );
  }
  if (work) {
    const stages: JobStage[] = [...FLOW.slice(0, -1), "on_hold"];
    rowTwo.push(
      <Panel key="jobs" title={own ? "My jobs by stage" : "Jobs by stage"} description={work.active === 0 ? "No active jobs." : `${work.active} active${work.overdue ? `, ${work.overdue} past their target date` : ""}.`} actions={<Link className="text-xs underline" href="/app/production">Open production</Link>}>
        {work.active === 0 ? (
          <p className="text-sm text-text-muted">{own ? "Nothing is assigned to you right now." : "Confirm a custom order to start a job."}</p>
        ) : (
          <BarChart color="#3b78c2" rows={stages.filter((st) => work.byStage[st]).map((st) => ({ label: STAGE_LABEL[st], value: work.byStage[st] ?? 0 }))} />
        )}
      </Panel>,
    );
  }
  if (ch.expenseByCategory) {
    const total = ch.expenseByCategory.reduce((a, b) => a + b.value, 0);
    rowTwo.push(
      <Panel key="spend" title="Spending by category" description={total === 0 ? "No expenses in these dates." : "Expenses recorded in these dates, voided ones left out."} actions={<Link className="text-xs underline" href="/app/expenses">All expenses</Link>}>
        {total === 0 ? <p className="text-sm text-text-muted">Nothing to show yet.</p> : <Donut segments={ch.expenseByCategory} centre={new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(total)} caption={business.currency} currency={business.currency} />}
      </Panel>,
    );
  }

  // Row 3: money still to collect, and what is going out the door.
  const rowThree: React.ReactNode[] = [];
  if (ch.receivables) {
    rowThree.push(
      <Panel key="rec" title="Largest unpaid balances" description="Confirmed orders not paid in full, biggest first." actions={<Link className="text-xs underline" href="/app/payments">All balances</Link>}>
        {ch.receivables.length === 0 ? (
          <p className="text-sm text-text-muted">Every confirmed order is paid in full.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {ch.receivables.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <Link className="font-medium underline decoration-border-strong underline-offset-2" href={`/app/orders/${r.id}`}>{r.reference}</Link>
                  <span className="block truncate text-xs text-text-muted">{r.customer} · {r.daysOpen === 0 ? "confirmed today" : `${r.daysOpen} ${r.daysOpen === 1 ? "day" : "days"} since confirmation`}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{moneyN(r.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>,
    );
  }
  if (ch.upcomingDeliveries) {
    rowThree.push(
      <Panel key="del" title="Deliveries in the next 7 days" description="Planned and out for delivery." actions={<Link className="text-xs underline" href="/app/deliveries">All deliveries</Link>}>
        {ch.upcomingDeliveries.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing is scheduled this week.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {ch.upcomingDeliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <Link className="font-medium underline decoration-border-strong underline-offset-2" href={`/app/deliveries/${d.id}`}>{d.reference}</Link>
                  <span className="block truncate text-xs text-text-muted">{d.contact}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold tabular-nums">{formatDate(d.on, business.timezone)}</span>
                  <span className="block text-xs text-text-muted">{d.status === "out_for_delivery" ? "Out for delivery" : "Planned"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>,
    );
  }

  // Row 4: what needs someone today.
  const attention: { label: string; value: number; href?: string; tone?: "warning" | "danger" }[] = [];
  if (sales) {
    attention.push(
      { label: "Unassigned open enquiries", value: sales.leads.unassignedOpen, href: "/app/leads?assignedTo=unassigned&status=open", tone: "warning" },
      { label: "Overdue follow-ups (everyone)", value: sales.followUps.overdueAll, href: "/app/follow-ups?who=all&status=overdue", tone: "danger" },
      { label: "Quotations past valid-until date", value: sales.quotations.pastValidityCount, href: "/app/quotations?status=sent", tone: "warning" },
    );
  }
  if (owner) {
    attention.push({ label: "Overdue workshop jobs", value: owner.ops.jobs.overdue, href: "/app/production", tone: "danger" }, { label: "Deliveries today", value: owner.deliveriesToday, href: "/app/deliveries" });
    if (owner.ops.afterSales) attention.push({ label: "Overdue after-sales cases", value: owner.ops.afterSales.overdue ?? 0, href: "/app/after-sales", tone: "danger" });
    if (owner.ops.stock) attention.push({ label: "Low-stock lines", value: owner.ops.stock.lowStockLines, href: "/app/stock", tone: "warning" });
  }
  const flagged = attention.filter((r) => r.value > 0);
  const rowFour: React.ReactNode[] = [];
  if (attention.length > 0) {
    rowFour.push(
      <Panel key="attention" title="Needs attention" description={flagged.length === 0 ? "Nothing is overdue or waiting." : `${flagged.length} ${flagged.length === 1 ? "item" : "items"} to look at.`}>
        <FactList rows={attention} />
      </Panel>,
    );
  }
  if (stock) {
    rowFour.push(<LowStockPanel key="stock" rows={stock.map((a) => ({ id: a.id, name: a.name, location: a.location, available: a.available, threshold: a.threshold, unit: a.unit }))} />);
  }

  const grid = (items: React.ReactNode[], cols: string) => (items.length > 0 ? <div className={`grid items-stretch gap-3 ${cols}`}>{items}</div> : null);
  const insights = (
    <>
      {grid(rowOne, "lg:grid-cols-3")}
      {grid(rowTwo, rowTwo.length >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2")}
      {grid(rowThree, "lg:grid-cols-2")}
      {grid(rowFour, "lg:grid-cols-2")}
    </>
  );

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
      setup={setup}
      locations={rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, isActive: r.isActive }))}
      kpis={kpis.length > 0 ? kpis.slice(0, kpis.length >= 8 ? 8 : kpis.length >= 4 ? 4 : kpis.length) : undefined}
      insights={insights}
      actions={kpis.length > 0 ? dateForm : undefined}
    />
  );
}
