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
import { PO_STATUSES, PO_STATUS_LABEL, PO_STATUS_TONE, SUPPLIER_PAY_LABEL, SUPPLIER_PAY_TONE } from "@/lib/purchasing-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listPurchaseOrders } from "@/server/purchasing";

export const metadata = { title: "Purchase orders" };

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), PO_STATUSES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listPurchaseOrders(actor, { status, q, page, pageSize: 25 })]);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtered = Boolean(status || q);
  return (
    <>
      <PageHeader title="Purchase orders" description="Materials ordered from suppliers. Stock increases only when goods are received." actions={can(actor, "purchasing:write") ? <ButtonLink href="/app/purchase-orders/new">New purchase order</ButtonLink> : undefined} />
      <form method="get" className="mb-6 grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:grid-cols-3 sm:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference or supplier" />
        <SelectField label="Status" name="status" showOptional={false} defaultValue={status ?? ""} placeholder="All" options={PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))} />
        <div className="flex gap-2"><Button type="submit">Apply</Button>{filtered ? <ButtonLink href="/app/purchase-orders" variant="ghost">Clear</ButtonLink> : null}</div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "purchase order" : "purchase orders"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No purchase orders match" : "No purchase orders yet"} description={filtered ? "Try clearing a filter." : "Create one to order materials from a supplier."} />
      ) : (
        <TableWrap label="Purchase orders">
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH><TH>Supplier</TH><TH>Status</TH>
                {result.showMoney ? <><TH className="text-right">Value</TH><TH className="hidden md:table-cell">Payment</TH></> : null}
                <TH className="hidden lg:table-cell">Expected</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/purchase-orders/${r.id}`}>{r.reference}</Link></TD>
                  <TD>{r.supplierName}</TD>
                  <TD><StatusBadge tone={PO_STATUS_TONE[r.status]}>{PO_STATUS_LABEL[r.status]}</StatusBadge></TD>
                  {result.showMoney ? (
                    <>
                      <TD numeric>{r.orderValue ? formatMoney(r.orderValue, r.currency) : "—"}</TD>
                      <TD className="hidden md:table-cell"><StatusBadge tone={SUPPLIER_PAY_TONE[r.paymentStatus]}>{SUPPLIER_PAY_LABEL[r.paymentStatus]}</StatusBadge></TD>
                    </>
                  ) : null}
                  <TD className="hidden whitespace-nowrap lg:table-cell">{r.expectedOn ? formatDate(r.expectedOn, business.timezone) : "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={pageCount} hrefFor={(n) => buildHref("/app/purchase-orders", { q, status, page: String(n) })} />
    </>
  );
}
