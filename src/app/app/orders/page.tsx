import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { ORDER_TONE } from "@/lib/order-ui";
import { ORDER_STATUSES, orderStatusLabel, orderTypeLabel } from "@/lib/schemas/orders";
import { formatDate } from "@/lib/time";
import { getBusinessSettings } from "@/lib/settings";
import { listOrders } from "@/server/orders";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), ORDER_STATUSES);
  const type = oneOf(one(sp.type), ["ready_made", "custom"] as const);
  const q = one(sp.q)?.slice(0, 80);
  const owing = one(sp.owing) === "1";
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listOrders(actor, { status, type, q, withBalanceOnly: owing, page, pageSize: 25 })]);
  const filtered = Boolean(status || type || q || owing);
  return (
    <>
      <PageHeader
        title="Orders"
        description="Ready-made sales and custom orders. Money is tracked as payments received against each order."
        actions={can(actor, "orders:write") ? <ButtonLink href="/app/orders/new">New ready-made order</ButtonLink> : undefined}
      />
      <form method="get" className="mb-6 grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference or customer" className="lg:col-span-2" />
        <SelectField label="Status" name="status" showOptional={false} defaultValue={status ?? ""} placeholder="All" options={ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s, "ready_made") }))} />
        <SelectField label="Type" name="type" showOptional={false} defaultValue={type ?? ""} placeholder="All" options={[{ value: "ready_made", label: "Ready-made" }, { value: "custom", label: "Custom" }]} />
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="owing" value="1" defaultChecked={owing} className="size-5 accent-[var(--color-walnut)]" /> Balance still owing
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Apply</Button>
          {filtered ? <ButtonLink href="/app/orders" variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "order" : "orders"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No orders match" : "No orders yet"} description={filtered ? "Try clearing a filter." : "Create a ready-made order, or convert an accepted quotation."} />
      ) : (
        <TableWrap label="Orders">
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Type</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden text-right lg:table-cell">Paid</TH>
                <TH className="hidden text-right lg:table-cell">Outstanding</TH>
                <TH className="hidden xl:table-cell">Created</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/orders/${r.id}`}>{r.reference}</Link></TD>
                  <TD>{r.customerName}</TD>
                  <TD className="hidden md:table-cell">{orderTypeLabel(r.type)}</TD>
                  <TD><StatusBadge tone={ORDER_TONE[r.status]}>{orderStatusLabel(r.status, r.type)}</StatusBadge></TD>
                  <TD numeric>{formatMoney(r.total, r.currency)}</TD>
                  <TD numeric className="hidden lg:table-cell">{r.paid === null ? "—" : formatMoney(r.paid, r.currency)}</TD>
                  <TD numeric className="hidden lg:table-cell">{r.outstanding === null ? "—" : formatMoney(r.outstanding, r.currency)}</TD>
                  <TD className="hidden whitespace-nowrap xl:table-cell">{formatDate(r.createdAt, business.timezone)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/orders", { q, status, type, owing: owing ? "1" : undefined, page: String(n) })} />
    </>
  );
}
