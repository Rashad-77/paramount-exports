import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_TONE } from "@/lib/order-ui";
import { FULFILMENT_LABEL, ORDER_STATUSES, PAYMENT_LABEL, STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { countOrdersByStatus, listOrders } from "@/server/orders";

export const metadata = { title: "Orders" };
const PAGE_SIZE = 20;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), [...ORDER_STATUSES, "open"] as const);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);

  const [business, counts, result] = await Promise.all([getBusinessSettings(), countOrdersByStatus(actor), listOrders(actor, { status, q, page, pageSize: PAGE_SIZE })]);
  const href = (over: Record<string, string | undefined>) => buildHref("/app/orders", { status, q, ...over });
  const open = counts.new + counts.confirmed + counts.in_progress;
  const tabs: { key: string | undefined; label: string; n: number }[] = [
    { key: undefined, label: "All", n: counts.all },
    { key: "open", label: "Open", n: open },
    ...ORDER_STATUSES.map((s) => ({ key: s as string, label: STATUS_LABEL[s], n: counts[s] })),
  ];

  return (
    <>
      <ModuleHeader href="/app/orders" />
      <nav aria-label="Order status" className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={buildHref("/app/orders", { status: t.key, q })}
            aria-current={status === t.key ? "page" : undefined}
            className={"inline-flex min-h-10 items-center gap-2 border px-3.5 text-sm " + (status === t.key ? "border-brand bg-brand font-semibold text-white" : "border-border-strong text-text-muted hover:text-text")}
          >
            {t.label}
            <span className="text-xs opacity-75">{t.n}</span>
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 border border-border bg-surface p-4">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <TextField showOptional={false} label="Search" name="q" type="search" defaultValue={q} placeholder="Order number, name, phone or email" className="min-w-64 flex-1" />
        <Button type="submit">Search</Button>
        {q ? (
          <ButtonLink href={href({ q: undefined })} variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      <p className="mb-3 text-sm text-text-muted" role="status">
        {result.total} {result.total === 1 ? "order" : "orders"}
      </p>
      {result.rows.length === 0 ? (
        <EmptyState title={q || status ? "No orders match" : "No orders yet"} description={q || status ? "Try a different tab or search." : "Orders placed on the website will appear here."} />
      ) : (
        <TableWrap label="Orders">
          <Table>
            <THead>
              <tr>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="hidden lg:table-cell">How</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden lg:table-cell">Placed</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/app/orders/${r.id}`} className="font-medium text-walnut underline">
                      {r.reference}
                    </Link>
                    <div className="text-xs text-text-muted">
                      {r.itemCount} {r.itemCount === 1 ? "item" : "items"}
                    </div>
                  </TD>
                  <TD>
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-text-muted">{r.phone}</div>
                    <div className="mt-1 md:hidden">
                      <StatusBadge tone={ORDER_STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                    </div>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <StatusBadge tone={ORDER_STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                    {r.isPaid ? (
                      <StatusBadge tone="success" className="ml-1.5">
                        Paid
                      </StatusBadge>
                    ) : null}
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <div>{FULFILMENT_LABEL[r.fulfilment]}</div>
                    <div className="text-text-muted">{PAYMENT_LABEL[r.paymentMethod]}</div>
                  </TD>
                  <TD numeric>{formatMoney(r.total, r.currency)}</TD>
                  <TD className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(r.createdAt, business.timezone)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => href({ page: String(n) })} />
    </>
  );
}
