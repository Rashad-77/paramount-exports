import { OrderStatusPicker } from "@/components/app/order-status-picker";
import { OrderPaymentPicker } from "@/components/app/order-payment-picker";
import { OrdersFilter } from "@/components/app/orders-filter";
import Link from "next/link";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import {
  Pagination,
  Table,
  TableWrap,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatAmount } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listOrders } from "@/server/orders";

export const metadata = { title: "Orders" };
const PAGE_SIZE = 20;
const SORTS = ["total_desc", "total_asc", "latest", "oldest"] as const;
const STATUS_FILTERS = ["new", "confirmed", "ready", "out_for_delivery", "delivered", "completed", "cancelled"] as const;
const PAYMENT_FILTERS = ["paid", "unpaid"] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const rawStatuses = one(sp.statuses);
  const rawPayments = one(sp.payments);
  let statuses = (rawStatuses?.split(",") ?? []).flatMap((value) => {
    const status = oneOf(value, STATUS_FILTERS);
    return status ? [status] : [];
  });
  let payments = (rawPayments?.split(",") ?? []).flatMap((value) => {
    const payment = oneOf(value, PAYMENT_FILTERS);
    return payment ? [payment] : [];
  });
  // Keep older bookmarked status tabs and status query links working.
  if (!rawStatuses) {
    const oldView = one(sp.view) ?? one(sp.status);
    if (oldView === "unpaid") payments = ["unpaid"];
    else if (oldView === "ready") statuses = ["ready", "out_for_delivery"];
    else if (oldView === "completed" || oldView === "delivered") statuses = ["completed"];
    else if (oldView === "in_progress") statuses = ["confirmed"];
    else {
      const legacyStatus = oneOf(oldView, STATUS_FILTERS);
      if (legacyStatus) statuses = [legacyStatus];
      else if (oldView === "confirmed") statuses = ["confirmed"];
    }
  }
  const q = one(sp.q)?.slice(0, 80);
  const sort = oneOf(one(sp.sort), SORTS) ?? "latest";
  const page = pageOf(sp);
  const filter = {
    statusFilters: statuses.length ? statuses : undefined,
    payments: payments.length ? payments : undefined,
  };

  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listOrders(actor, { ...filter, q, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/orders", {
      statuses: statuses.length ? statuses.join(",") : undefined,
      payments: payments.length ? payments.join(",") : undefined,
      q,
      sort,
      ...over,
    });
  const statusAt = (r: (typeof result.rows)[number]) => {
    if (r.statusChangedAt) return r.statusChangedAt;
    switch (r.status) {
      case "new": return r.createdAt;
      case "confirmed": return r.confirmedAt;
      case "in_progress": return r.confirmedAt;
      case "ready": return r.readyAt;
      case "out_for_delivery": return r.outForDeliveryAt;
      case "delivered": return r.deliveredAt;
      case "cancelled": return r.cancelledAt;
    }
  };

  return (
    <>
      <ModuleHeader href="/app/orders" />
      <OrdersFilter action="/app/orders" q={q} sort={sort} statuses={statuses} payments={payments} />
      <div className="app-results">
        <p className="mb-3 text-sm text-text-muted" role="status">
          {result.total} {result.total === 1 ? "order" : "orders"}
        </p>
        {result.rows.length === 0 ? (
          <EmptyState
            title={q || statuses.length || payments.length ? "No orders match" : "No orders yet"}
            description={
              q || statuses.length || payments.length
                ? "Try different filters or search terms."
                : "Orders placed on the website will appear here."
            }
          />
        ) : (
          <TableWrap label="Orders">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10 text-right">No.</TH>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Order content</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Total ({business.currency})</TH>
                  <TH className="w-44 min-w-[11rem]">Status</TH>
                  <TH className="w-36 min-w-[9rem]">Payment</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((r, i) => (
                  <TR key={r.id}>
                    <TD numeric className="text-text-muted">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </TD>
                    <TD>
                      <Link
                        href={`/app/orders/${r.id}`}
                        className="inline-flex w-fit border border-border px-1.5 py-0.5 font-medium text-walnut underline hover:text-brand-dark"
                      >
                        {r.reference}
                      </Link>
                    </TD>
                    <TD>
                      <div className="font-medium">{r.customerName}</div>
                      <div className="text-text-muted">{r.phone}</div>
                    </TD>
                    <TD className="max-w-[14rem] px-2 py-1 leading-snug">
                      {r.contents ? (
                        <div>
                          {r.contents.split("\n").map((item, itemIndex, items) => (
                            <div
                              key={`${itemIndex}-${item}`}
                              className="py-1 first:pt-0 last:pb-0"
                              style={itemIndex < items.length - 1 ? {
                                width: "calc(100% + 1.5rem)",
                                marginLeft: "-0.75rem",
                                paddingLeft: "0.75rem",
                                paddingRight: "0.5rem",
                                borderBottom: "1px solid var(--color-border)",
                              } : undefined}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted">No items</span>
                      )}
                    </TD>
                    <TD numeric>
                      {r.quantities ? (
                        <div>
                          {r.quantities.split("\n").map((quantity, itemIndex, quantities) => (
                            <div
                              key={`${itemIndex}-${quantity}`}
                              className="py-1 first:pt-0 last:pb-0"
                              style={itemIndex < quantities.length - 1 ? {
                                width: "calc(100% + 1.5rem)",
                                marginLeft: "-0.75rem",
                                paddingLeft: "0.75rem",
                                paddingRight: "0.75rem",
                                borderBottom: "1px solid var(--color-border)",
                              } : undefined}
                            >
                              {quantity}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "0"
                      )}
                    </TD>
                    <TD numeric>{formatAmount(r.total)}</TD>
                    <TD className="w-44 min-w-[11rem] whitespace-nowrap text-center">
                      <OrderStatusPicker
                        id={r.id}
                        reference={r.reference}
                        status={r.status}
                        statusDate={statusAt(r)?.toISOString() ?? null}
                        statusDateLabel={statusAt(r) ? formatDateTime(statusAt(r)!, business.timezone) : null}
                        isPaid={r.isPaid}
                        fulfilment={r.fulfilment}
                        canUpdate={can(actor, "orders:update")}
                        canCancel={can(actor, "orders:cancel")}
                        customerCancelled={
                          r.status === "cancelled" &&
                          (r.handledBy === null ||
                            r.cancelReason?.startsWith("Sample: customer changed their mind") === true)
                        }
                      />
                    </TD>
                    <TD className="w-36 min-w-[9rem] whitespace-nowrap text-center">
                      <OrderPaymentPicker
                        id={r.id}
                        reference={r.reference}
                        paid={r.isPaid}
                        canUpdate={can(actor, "orders:record_payment")}
                        disabled={r.status === "cancelled"}
                      />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination
          page={page}
          pageCount={result.pageCount}
          hrefFor={(n) => href({ page: String(n) })}
        />
      </div>
    </>
  );
}
