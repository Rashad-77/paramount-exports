import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Definitions, Metric, Metrics, ReportSection } from "@/components/app/report-parts";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { STAGE_LABEL, type JobStage } from "@/lib/production";
import { formatDate } from "@/lib/time";
import { getFinancialReport, getOperationsReport, getSalesReport, resolveRange } from "@/server/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const range = await resolveRange(one(sp.from), one(sp.to));
  const { currency: cur, timezone: tz } = range;
  const wantSales = can(actor, "reports:sales");
  const wantFin = can(actor, "reports:financial");
  const wantOps = can(actor, "reports:operations");
  const qs = `from=${range.from}&to=${range.to}`;
  const exp = (kind: string, label: string) => <ButtonLink key={kind} href={`/api/reports/export/${kind}?${qs}`} variant="secondary" download>{label}<span className="sr-only"> (CSV file)</span></ButtonLink>;

  const [sales, fin, ops] = await Promise.all([wantSales ? getSalesReport(actor, range) : null, wantFin ? getFinancialReport(actor, range) : null, wantOps ? getOperationsReport(actor, range) : null]);

  return (
    <>
      <PageHeader title="Reports" description="Operational figures for a date range you choose. Each section says exactly what is counted." />
      <form method="get" className="mb-6 flex flex-col gap-4 border border-border bg-surface p-4 sm:flex-row sm:items-end">
        <TextField label="From" name="from" type="date" showOptional={false} defaultValue={range.from} />
        <TextField label="To" name="to" type="date" showOptional={false} defaultValue={range.to} />
        <Button type="submit">Show report</Button>
        <p className="text-sm text-text-muted sm:ml-auto" role="status">{formatDate(range.from, tz)} – {formatDate(range.to, tz)} (inclusive, {tz})</p>
      </form>

      {!sales && !fin && !ops ? <EmptyState title="No reports for your role" description="Ask the owner if you need access." /> : null}

      <div className="min-w-0 space-y-6">
        {sales ? (
          <ReportSection title="Sales" description={sales.scope === "own" ? "Your own orders and quotations only." : "Orders, quotations and money received."} exports={exp("orders", "Orders CSV")}>
            <Metrics>
              <Metric label="Orders confirmed" value={sales.confirmed.count} hint={`Value ${formatMoney(sales.confirmed.value, cur)}`} />
              <Metric label="Orders delivered" value={sales.delivered.count} hint={`Value ${formatMoney(sales.delivered.value, cur)}`} />
              {sales.cashReceived !== null ? <Metric label="Cash received" value={formatMoney(sales.cashReceived, cur)} hint="Net of reversals" /> : null}
              <Metric label="Quotations sent" value={sales.quotations.sent} />
              <Metric label="Quotations accepted" value={sales.quotations.accepted} hint={`Value ${formatMoney(sales.quotations.acceptedValue, cur)}`} />
              {sales.outstanding ? <Metric label="Outstanding now" value={formatMoney(sales.outstanding.value, cur)} hint={`${sales.outstanding.count} ${sales.outstanding.count === 1 ? "order" : "orders"}`} /> : null}
            </Metrics>
            {sales.byType.length > 0 ? (
              <TableWrap label="Confirmed orders by type" className="mt-4">
                <Table>
                  <THead><tr><TH>Type</TH><TH className="text-right">Orders</TH><TH className="text-right">Value</TH></tr></THead>
                  <tbody>{sales.byType.map((t) => <TR key={t.type}><TD>{t.type === "custom" ? "Custom" : "Ready-made"}</TD><TD numeric>{t.count}</TD><TD numeric>{formatMoney(t.value, cur)}</TD></TR>)}</tbody>
                </Table>
              </TableWrap>
            ) : null}
            <Definitions items={sales.definitions} />
          </ReportSection>
        ) : null}

        {fin ? (
          <ReportSection title="Money in and out" description="An operational view of cash, not accounts." exports={<>{exp("payments", "Payments CSV")}{exp("expenses", "Expenses CSV")}</>}>
            <Metrics cols={4}>
              <Metric label="Cash received" value={formatMoney(fin.cashReceived, cur)} />
              <Metric label="Expenses" value={formatMoney(fin.expenses, cur)} />
              <Metric label="Supplier payments" value={formatMoney(fin.supplierPayments, cur)} />
              <Metric label="Net cash movement" value={formatMoney(fin.netCashMovement, cur)} hint="Not profit" />
              <Metric label="Owed by customers" value={formatMoney(fin.owedByCustomers.value, cur)} hint={`${fin.owedByCustomers.count} ${fin.owedByCustomers.count === 1 ? "order" : "orders"}, right now`} />
              <Metric label="Owed to suppliers" value={formatMoney(fin.owedToSuppliers.value, cur)} hint={fin.owedToSuppliers.ordersWithoutInvoice ? `${fin.owedToSuppliers.ordersWithoutInvoice} purchase orders have no invoice recorded` : "Based on recorded invoices"} />
            </Metrics>
            {fin.expensesByCategory.length > 0 ? (
              <TableWrap label="Expenses by category" className="mt-4">
                <Table>
                  <THead><tr><TH>Category</TH><TH className="text-right">Entries</TH><TH className="text-right">Total</TH></tr></THead>
                  <tbody>{fin.expensesByCategory.map((c) => <TR key={c.category}><TD>{c.category}</TD><TD numeric>{c.count}</TD><TD numeric>{formatMoney(c.total, cur)}</TD></TR>)}</tbody>
                </Table>
              </TableWrap>
            ) : null}
            <Definitions items={fin.definitions} />
          </ReportSection>
        ) : null}

        {ops ? (
          <ReportSection title="Workshop, deliveries and stock" description={ops.scope === "own" ? "Your assigned jobs and deliveries." : undefined} exports={<>{exp("jobs", "Jobs CSV")}{ops.stock ? exp("stock", "Stock CSV") : null}</>}>
            <Metrics cols={4}>
              <Metric label="Active jobs" value={ops.jobs.active} hint={ops.jobs.overdue ? `${ops.jobs.overdue} overdue` : "None overdue"} />
              <Metric label="Jobs completed" value={ops.jobs.completedInRange} />
              <Metric label="Deliveries delivered" value={ops.deliveries.delivered ?? 0} hint={`${ops.deliveries.failed ?? 0} failed · ${(ops.deliveries.planned ?? 0) + (ops.deliveries.out_for_delivery ?? 0)} still open`} />
              {ops.openPurchaseOrders !== null ? <Metric label="Open purchase orders" value={ops.openPurchaseOrders} /> : null}
              {ops.stock ? <Metric label="Low-stock lines" value={ops.stock.lowStockLines} /> : null}
              {ops.stock?.valueAtCost != null ? <Metric label="Stock value at cost" value={formatMoney(ops.stock.valueAtCost, cur)} hint={ops.stock.itemsWithoutCost ? `${ops.stock.itemsWithoutCost} items on hand have no cost and are left out` : "All items on hand have a cost"} /> : null}
              {ops.afterSales ? <Metric label="Open after-sales cases" value={ops.afterSales.open} hint={ops.afterSales.overdue ? `${ops.afterSales.overdue} overdue` : undefined} /> : null}
            </Metrics>
            {Object.keys(ops.jobs.byStage).length > 0 ? (
              <TableWrap label="Active jobs by stage" className="mt-4">
                <Table>
                  <THead><tr><TH>Stage</TH><TH className="text-right">Jobs</TH></tr></THead>
                  <tbody>{Object.entries(ops.jobs.byStage).map(([s, n]) => <TR key={s}><TD>{STAGE_LABEL[s as JobStage] ?? s}</TD><TD numeric>{n}</TD></TR>)}</tbody>
                </Table>
              </TableWrap>
            ) : null}
            <Definitions items={ops.definitions} />
          </ReportSection>
        ) : null}
      </div>
    </>
  );
}
