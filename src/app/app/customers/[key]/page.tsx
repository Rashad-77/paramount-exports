import { OrderTag, QuoteTag, EnquiryTag } from "@/components/app/tags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { isQuoteStatus, quoteRef } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getCustomer } from "@/server/orders";

export const metadata = { title: "Customer" };

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
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
      <PageHeader back={{ href: "/app/customers", to: "customers" }}
        title={c.name}
        description={`${c.orders.length} ${c.orders.length === 1 ? "order" : "orders"} · ${c.quotations.length} ${c.quotations.length === 1 ? "quotation" : "quotations"} · ${c.enquiries.length} ${c.enquiries.length === 1 ? "enquiry" : "enquiries"} · ${formatMoney(c.spent, c.currency)} ordered in total (cancelled orders not counted)`}
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Contact">
          <p className="text-sm">
            <a
              className="underline"
              href={`tel:${c.phone.replace(/\s+/g, "")}`}
            >
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
          {c.hasAccount ? (
            <p className="mt-3 text-sm text-text-muted">
              Has a website account: some of these orders were placed while
              signed in.
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
        <div className="min-w-0 space-y-6">
          <Panel title="Order history">
            {c.orders.length === 0 ? (
              <p className="text-sm text-text-muted">No orders yet.</p>
            ) : (
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
                          <Link
                            href={`/app/orders/${o.id}`}
                            className="font-medium text-walnut underline"
                          >
                            {o.reference}
                          </Link>
                        </TD>
                        <TD>
                          <OrderTag status={o.status} />
                        </TD>
                        <TD numeric>{formatMoney(o.total, o.currency)}</TD>
                        <TD className="hidden whitespace-nowrap sm:table-cell">
                          {formatDateTime(o.createdAt, business.timezone)}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Panel>
          <Panel title="Quotation history">
            {c.quotations.length === 0 ? (
              <p className="text-sm text-text-muted">No quotation requests.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {c.quotations.map((m) => {
                  const st = isQuoteStatus(m.quoteStatus)
                    ? m.quoteStatus
                    : "requested";
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span>
                        <Link
                          href={`/app/messages/${m.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {quoteRef(m.reference)}
                        </Link>
                        <span className="block text-text-muted">
                          {formatDateTime(m.createdAt, business.timezone)}
                          {m.quotedAmount
                            ? ` · ${formatMoney(m.quotedAmount, business.currency)}`
                            : ""}
                        </span>
                      </span>
                      <QuoteTag status={st} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Enquiries">
            {c.enquiries.length === 0 ? (
              <p className="text-sm text-text-muted">No enquiries.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {c.enquiries.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/app/messages/${m.id}`}
                        className="font-medium text-walnut underline"
                      >
                        {m.reference}
                      </Link>
                      <span className="block text-text-muted">
                        {MESSAGE_KIND_LABEL[m.kind] ?? m.kind} ·{" "}
                        {formatDateTime(m.createdAt, business.timezone)}
                      </span>
                      {m.message ? (
                        <span className="line-clamp-1 block max-w-md text-text-muted">
                          {m.message}
                        </span>
                      ) : null}
                    </span>
                    {m.isHandled ? (
                      <EnquiryTag state="responded" />
                    ) : (
                      <EnquiryTag state="new" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
