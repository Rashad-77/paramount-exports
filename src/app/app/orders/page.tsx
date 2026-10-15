import { OrderTag, PaidTag } from "@/components/app/tags";
import Link from "next/link";
import { ListSearch } from "@/components/app/list-search";
import { FilterTabs } from "@/components/app/filter-tabs";
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
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import {
  FULFILMENT_LABEL,
  PAYMENT_LABEL,
  type OrderStatus,
} from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { countOrdersByStatus, listOrders } from "@/server/orders";

export const metadata = { title: "Orders" };
const PAGE_SIZE = 20;

const VIEWS = [
  "new",
  "confirmed",
  "unpaid",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
] as const;
type View = (typeof VIEWS)[number];

/** Older links used ?status=; they still work. */
const LEGACY: Record<string, View> = {
  new: "new",
  confirmed: "confirmed",
  in_progress: "in_progress",
  ready: "ready",
  out_for_delivery: "ready",
  delivered: "delivered",
  cancelled: "cancelled",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const legacy = one(sp.status);
  const view: View | undefined =
    oneOf(one(sp.view), VIEWS) ?? (legacy ? LEGACY[legacy] : undefined);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);

  const filter =
    view === "unpaid"
      ? { payment: "unpaid" as const }
      : view === "ready"
        ? { statuses: ["ready", "out_for_delivery"] as OrderStatus[] }
        : view
          ? { status: view as OrderStatus }
          : {};

  const [business, counts, result, unpaid] = await Promise.all([
    getBusinessSettings(),
    countOrdersByStatus(actor),
    listOrders(actor, { ...filter, q, page, pageSize: PAGE_SIZE }),
    listOrders(actor, { payment: "unpaid", page: 1, pageSize: 1 }),
  ]);
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/orders", { view, q, ...over });
  const tab = (key: View | undefined, label: string, n: number) => ({
    label,
    count: n,
    active: view === key,
    href: buildHref("/app/orders", { view: key, q }),
  });

  return (
    <>
      <ModuleHeader href="/app/orders" />
      <FilterTabs
        label="Order status"
        tabs={[
          tab(undefined, "All", counts.all),
          tab("new", "New", counts.new),
          tab("confirmed", "Confirmed", counts.confirmed),
          tab("unpaid", "Awaiting payment", unpaid.total),
          tab("in_progress", "In production", counts.in_progress),
          tab("ready", "Ready", counts.ready + counts.out_for_delivery),
          tab("delivered", "Completed", counts.delivered),
          tab("cancelled", "Cancelled", counts.cancelled),
        ]}
      />
      <ListSearch
        action="/app/orders"
        params={{ view }}
        q={q}
        placeholder="Order number, name, phone or email"
      />
      <div className="app-results">
        <p className="mb-3 text-sm text-text-muted" role="status">
          {result.total} {result.total === 1 ? "order" : "orders"}
        </p>
        {result.rows.length === 0 ? (
          <EmptyState
            title={q || view ? "No orders match" : "No orders yet"}
            description={
              q || view
                ? "Try a different tab or search."
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
                  <TH className="hidden md:table-cell">Order content</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="hidden md:table-cell">Status</TH>
                  <TH className="hidden lg:table-cell">Payment</TH>
                  <TH className="hidden lg:table-cell">
                    Delivery or collection
                  </TH>
                  <TH className="text-right">Total</TH>
                  <TH className="hidden xl:table-cell">Placed</TH>
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
                        className="font-medium text-walnut underline"
                      >
                        {r.reference}
                      </Link>
                    </TD>
                    <TD>
                      <div className="font-medium">{r.customerName}</div>
                      <div className="text-text-muted">{r.phone}</div>
                      <div className="mt-1 md:hidden">
                        <OrderTag status={r.status} />
                      </div>
                    </TD>
                    <TD className="hidden max-w-[16rem] md:table-cell">
                      {r.contents ? (
                        <span className="line-clamp-3 whitespace-pre-line">
                          {r.contents}
                        </span>
                      ) : (
                        <span className="text-text-muted">No items</span>
                      )}
                    </TD>
                    <TD numeric>{r.itemCount}</TD>
                    <TD className="hidden md:table-cell">
                      <OrderTag status={r.status} />
                    </TD>
                    <TD className="hidden lg:table-cell">
                      {r.status === "cancelled" ? (
                        <span className="text-text-muted">—</span>
                      ) : r.isPaid ? (
                        <PaidTag paid />
                      ) : (
                        <PaidTag paid={false} />
                      )}
                      <div className="mt-1 text-text-muted">
                        {PAYMENT_LABEL[r.paymentMethod]}
                      </div>
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <div>{FULFILMENT_LABEL[r.fulfilment]}</div>
                      {r.scheduledFor ? (
                        <div className="text-text-muted">
                          {formatDate(r.scheduledFor, "UTC")}
                        </div>
                      ) : null}
                    </TD>
                    <TD numeric>{formatMoney(r.total, r.currency)}</TD>
                    <TD className="hidden whitespace-nowrap xl:table-cell">
                      {formatDateTime(r.createdAt, business.timezone)}
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
