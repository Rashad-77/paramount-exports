import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { ORDER_TONE } from "@/lib/order-ui";
import { orderStatusLabel } from "@/lib/schemas/orders";
import { listOrders } from "@/server/orders";

export const metadata = { title: "Invoicing" };

/** Orders that still owe money. Open an order to record a payment against it. */
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const page = pageOf(await searchParams);
  const raw = await listOrders(actor, { withBalanceOnly: true, page, pageSize: 25 });
  // Sales staff only see money on their own orders; rows they may not see money for are left out here.
  const r = { ...raw, rows: raw.rows.filter((o) => o.outstanding !== null) };
  return (
    <>
      <ModuleHeader href="/app/payments" actions={<ButtonLink href="/app/orders" variant="secondary">All orders</ButtonLink>} />
      {r.rows.length === 0 ? (
        <EmptyState title="Nothing outstanding" description="Every confirmed order you can see is paid in full." />
      ) : (
        <TableWrap label="Orders with an outstanding balance">
          <Table>
            <THead>
              <tr>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="text-right">Received</TH>
                <TH className="text-right">Outstanding</TH>
              </tr>
            </THead>
            <tbody>
              {r.rows.map((o) => (
                <TR key={o.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/orders/${o.id}`}>{o.reference}</Link></TD>
                  <TD>{o.customerName}</TD>
                  <TD><StatusBadge tone={ORDER_TONE[o.status]}>{orderStatusLabel(o.status, o.type)}</StatusBadge></TD>
                  <TD numeric>{formatMoney(o.total, o.currency)}</TD>
                  <TD numeric>{o.paid === null ? "—" : formatMoney(o.paid, o.currency)}</TD>
                  <TD numeric className="font-semibold">{o.outstanding === null ? "—" : formatMoney(o.outstanding, o.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={r.pageCount} hrefFor={(n) => buildHref("/app/payments", { page: String(n) })} />
    </>
  );
}
