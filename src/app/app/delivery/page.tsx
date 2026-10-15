import { OrderTag } from "@/components/app/tags";
import Link from "next/link";
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
import { formatAmount } from "@/lib/money";
import { type Fulfilment, type OrderStatus } from "@/lib/schemas/orders";
import { formatDate } from "@/lib/time";
import { listOrders } from "@/server/orders";

export const metadata = { title: "Delivery and collection" };
const PAGE_SIZE = 20;

const VIEWS = {
  ready: {
    label: "Ready for delivery",
    fulfilment: "delivery" as Fulfilment,
    statuses: ["ready"] as OrderStatus[],
  },
  out: {
    label: "Out for delivery",
    fulfilment: "delivery" as Fulfilment,
    statuses: ["out_for_delivery"] as OrderStatus[],
  },
  done: {
    label: "Completed deliveries",
    fulfilment: "delivery" as Fulfilment,
    statuses: ["delivered"] as OrderStatus[],
  },
  collections: {
    label: "Store collections",
    fulfilment: "pickup" as Fulfilment,
    statuses: [
      "confirmed",
      "in_progress",
      "ready",
      "delivered",
    ] as OrderStatus[],
  },
  charges: {
    label: "Delivery charges",
    fulfilment: "delivery" as Fulfilment,
    statuses: [
      "confirmed",
      "in_progress",
      "ready",
      "out_for_delivery",
      "delivered",
    ] as OrderStatus[],
  },
};
type View = keyof typeof VIEWS;
const KEYS = Object.keys(VIEWS) as View[];

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const view: View = oneOf(one(sp.view), KEYS) ?? "ready";
  const page = pageOf(sp);
  const v = VIEWS[view];

  const [result, ...counts] = await Promise.all([
    listOrders(actor, {
      fulfilment: v.fulfilment,
      statuses: v.statuses,
      page,
      pageSize: PAGE_SIZE,
    }),
    ...KEYS.map((k) =>
      listOrders(actor, {
        fulfilment: VIEWS[k].fulfilment,
        statuses: VIEWS[k].statuses,
        page: 1,
        pageSize: 1,
      }),
    ),
  ]);
  const countOf = Object.fromEntries(
    KEYS.map((k, i) => [k, counts[i]!.total]),
  ) as Record<View, number>;
  const currency = result.rows[0]?.currency ?? "LKR";
  const showCharge = view === "charges" || view === "done";

  return (
    <>
      <ModuleHeader href="/app/delivery" />
      <FilterTabs
        label="Delivery and collection views"
        tabs={KEYS.map((k) => ({
          label: VIEWS[k].label,
          count: countOf[k],
          active: k === view,
          href: buildHref("/app/delivery", {
            view: k === "ready" ? undefined : k,
          }),
        }))}
      />

      {result.rows.length === 0 ? (
        <EmptyState
          title={`Nothing under “${v.label}”`}
          description="Orders appear here as they move along. Move an order on from its own page."
        />
      ) : (
        <TableWrap label={v.label}>
          <Table>
            <THead>
              <tr>
                <TH>Order</TH>
                <TH>Customer</TH>
                <TH>Order content</TH>
                <TH className="text-right">Qty</TH>
                <TH>Status</TH>
                <TH>
                  {v.fulfilment === "delivery" ? "Deliver to" : "Collection"}
                </TH>
                <TH>
                  {v.fulfilment === "delivery" ? "Delivery date" : "Date"}
                </TH>
                {showCharge ? (
                  <TH className="text-right">Delivery charge ({currency})</TH>
                ) : null}
                <TH className="text-right">Total ({currency})</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
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
                  </TD>
                  <TD className="max-w-[16rem]">
                    {r.contents ? (
                      <span className="whitespace-pre-line">{r.contents}</span>
                    ) : (
                      <span className="text-text-muted">No items</span>
                    )}
                  </TD>
                  <TD numeric className="whitespace-pre-line">
                    {r.quantities || "0"}
                  </TD>
                  <TD>
                    <OrderTag status={r.status} />
                  </TD>
                  <TD className="max-w-xs">
                    <span className="line-clamp-2 whitespace-pre-line">
                      {r.fulfilment === "delivery" ? r.address : "Showroom"}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {r.scheduledFor ? (
                      formatDate(r.scheduledFor, "UTC")
                    ) : (
                      <span className="text-text-muted">Not set</span>
                    )}
                  </TD>
                  {showCharge ? (
                    <TD numeric>
                      {Number(r.deliveryCharge) > 0 ? (
                        formatAmount(r.deliveryCharge)
                      ) : (
                        <span className="text-text-muted">To be agreed</span>
                      )}
                    </TD>
                  ) : null}
                  <TD numeric>{formatAmount(r.total)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination
        page={page}
        pageCount={result.pageCount}
        hrefFor={(n) =>
          buildHref("/app/delivery", {
            view: view === "ready" ? undefined : view,
            page: String(n),
          })
        }
      />
    </>
  );
}
