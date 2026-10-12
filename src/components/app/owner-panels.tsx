import Link from "next/link";
import { Metric, Metrics } from "@/components/app/report-parts";
import { Panel } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/money";
import type { getOwnerDashboard, getFinancialReport } from "@/server/reports";

type Owner = Awaited<ReturnType<typeof getOwnerDashboard>>;
type Fin = Awaited<ReturnType<typeof getFinancialReport>>;

export function FinancePanel({ fin, currency, from, to }: { fin: Fin; currency: string; from: string; to: string }) {
  return (
    <Panel title="Money in and out" description={`${from} to ${to}. Operational cash view — not profit.`} actions={<Link className="inline-flex min-h-10 items-center text-sm underline" href={`/app/reports?from=${from}&to=${to}`}>Full report</Link>}>
      <Metrics>
        <Metric label="Cash received" value={formatMoney(fin.cashReceived, currency)} />
        <Metric label="Expenses" value={formatMoney(fin.expenses, currency)} />
        <Metric label="Supplier payments" value={formatMoney(fin.supplierPayments, currency)} />
        <Metric label="Net cash movement" value={formatMoney(fin.netCashMovement, currency)} />
        <Metric label="Owed by customers" value={formatMoney(fin.owedByCustomers.value, currency)} hint={`${fin.owedByCustomers.count} orders`} />
        <Metric label="Owed to suppliers" value={formatMoney(fin.owedToSuppliers.value, currency)} />
      </Metrics>
    </Panel>
  );
}

export function OwnerPanel({ d, currency }: { d: Owner; currency: string }) {
  return (
    <>
      <Panel title="Business at a glance" description={`${d.range.from} to ${d.range.to}.`} actions={<Link className="inline-flex min-h-10 items-center text-sm underline" href={`/app/reports?from=${d.range.from}&to=${d.range.to}`}>Reports</Link>}>
        <Metrics cols={2}>
          <Metric label="Orders confirmed" value={d.sales.confirmed.count} hint={formatMoney(d.sales.confirmed.value, currency)} />
          <Metric label="Cash received" value={formatMoney(d.fin.cashReceived, currency)} />
          <Metric label="Expenses" value={formatMoney(d.fin.expenses, currency)} />
          <Metric label="Net cash movement" value={formatMoney(d.fin.netCashMovement, currency)} hint="Not profit" />
        </Metrics>
      </Panel>
      <Panel title="Needs attention">
        <Metrics cols={2}>
          <Metric label="Owed by customers" value={formatMoney(d.fin.owedByCustomers.value, currency)} hint={`${d.fin.owedByCustomers.count} orders`} />
          <Metric label="Owed to suppliers" value={formatMoney(d.fin.owedToSuppliers.value, currency)} />
          <Metric label="Overdue jobs" value={d.ops.jobs.overdue} hint={`${d.ops.jobs.active} active`} />
          <Metric label="Deliveries today" value={d.deliveriesToday} />
          {d.ops.afterSales ? <Metric label="Open after-sales cases" value={d.ops.afterSales.open} hint={d.ops.afterSales.overdue ? `${d.ops.afterSales.overdue} overdue` : undefined} /> : null}
          {d.ops.stock ? <Metric label="Low-stock lines" value={d.ops.stock.lowStockLines} /> : null}
        </Metrics>
      </Panel>
    </>
  );
}
