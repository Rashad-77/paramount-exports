import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_TONE } from "@/lib/order-ui";
import { STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getCustomer } from "@/server/orders";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const actor = await requireActor();
  let c;
  try {
    c = await getCustomer(actor, key);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  return (
    <>
      <PageHeader title={c.name} description={`${c.orders.length} ${c.orders.length === 1 ? "order" : "orders"} · ${formatMoney(c.spent, c.currency)} ordered in total (cancelled orders not counted)`} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Contact">
          <p className="text-sm">
            <a className="underline" href={`tel:${c.phone.replace(/\s+/g, "")}`}>
              {c.phone}
            </a>
          </p>
          {c.email ? (
            <p className="text-sm">
              <a className="underline" href={`mailto:${c.email}`}>
                {c.email}
              </a>
            </p>
          ) : null}
          {c.addresses.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm text-text-muted">Delivery addresses used</p>
              <ul className="mt-1 space-y-2 text-sm">
                {c.addresses.map((a) => (
                  <li key={a} className="whitespace-pre-line">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        <Panel title="Orders">
          <TableWrap label="Orders from this customer">
            <Table>
              <THead>
                <tr>
                  <TH>Order</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="hidden sm:table-cell">Placed</TH>
                </tr>
              </THead>
              <tbody>
                {c.orders.map((o) => (
                  <TR key={o.id}>
                    <TD>
                      <Link href={`/app/orders/${o.id}`} className="font-medium text-walnut underline">
                        {o.reference}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusBadge>
                    </TD>
                    <TD numeric>{formatMoney(o.total, o.currency)}</TD>
                    <TD className="hidden whitespace-nowrap sm:table-cell">{formatDateTime(o.createdAt, business.timezone)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      </div>
    </>
  );
}
