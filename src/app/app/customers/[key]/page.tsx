import { addressStacked } from "@/lib/address-lines";
import { plainPhone } from "@/lib/contact";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { EnquiryTag, OrderTag, QuoteTag } from "@/components/app/tags";
import { PageHeader } from "@/components/ui/page-header";
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

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** A record's reference as a small bordered link, the same way names and numbers are linked in the lists. */
function Ref({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block border border-border px-2 py-0.5 text-walnut underline"
    >
      {children}
    </Link>
  );
}

/** One titled part of the record, set apart from the one above it by the heavy rule, like the parts of an order. */
function Part({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={first ? undefined : "border-t-2 border-border-strong pt-6"}
    >
      <h3 className="mb-3 text-sm font-semibold text-walnut">{title}</h3>
      {children}
    </section>
  );
}

/** A row of the details table: the label in a shaded cell, the value beside it. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TR className="hover:bg-transparent">
      <TH scope="row" className="w-40 border-r border-border text-left">
        {label}
      </TH>
      <TD>{children}</TD>
    </TR>
  );
}

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
  const tz = business.timezone;
  const tel = `tel:${c.phone.replace(/\s+/g, "")}`;

  return (
    <>
      <PageHeader
        back={{ href: "/app/customers", to: "customers" }}
        title={c.name}
        description={`CUS-${c.phoneKey} · ${count(c.orders.length, "order", "orders")}, ${count(c.quotations.length, "quotation", "quotations")}, ${count(c.enquiries.length, "enquiry", "enquiries")}`}
      />

      <div className="space-y-6">
        <section className="min-w-0 border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-walnut">
              Customer record
            </h2>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-8 p-4">
            <Part title="Customer details" first>
              <TableWrap label="Customer details">
                <Table className="table-fixed">
                  <tbody>
                    <Detail label="Name">
                      <span className="font-medium">{c.name}</span>
                    </Detail>
                    <Detail label="ID">CUS-{c.phoneKey}</Detail>
                    <Detail label="Mobile">
                      <a className="underline" href={tel}>
                        {plainPhone(c.phone)}
                      </a>
                    </Detail>
                    <Detail label="Email">
                      {c.email ? (
                        <a className="underline" href={`mailto:${c.email}`}>
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Detail>
                    <Detail label="Website account">
                      {c.hasAccount ? "Yes" : "No"}
                    </Detail>
                    <Detail label="Delivery addresses">
                      {c.savedAddresses.length > 0 || c.addresses.length > 0 ? (
                        <ul className="divide-y divide-border">
                          {c.savedAddresses.map((a) => (
                            <li
                              key={a.address}
                              className="whitespace-pre-line py-3 first:pt-0 last:pb-0"
                            >
                              {a.isDefault ? (
                                <span className="block text-text-muted">
                                  (default)
                                </span>
                              ) : null}
                              <span className="block whitespace-pre-line">
                                {addressStacked(a.address)}
                              </span>
                            </li>
                          ))}
                          {c.addresses
                            .filter(
                              (a) =>
                                !c.savedAddresses.some((s) => s.address === a),
                            )
                            .map((a) => (
                              <li
                                key={a}
                                className="whitespace-pre-line py-3 first:pt-0 last:pb-0"
                              >
                                <span className="block whitespace-pre-line">
                                  {addressStacked(a)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </Detail>
                  </tbody>
                </Table>
              </TableWrap>
            </Part>

            <Part title="Orders">
              {c.orders.length === 0 ? (
                <p className="text-sm text-text-muted">No orders yet.</p>
              ) : (
                <TableWrap label="Orders from this customer">
                  <Table>
                    <THead>
                      <tr>
                        <TH className="w-16">No.</TH>
                        <TH className="text-left">Order</TH>
                        <TH className="hidden text-left sm:table-cell">
                          Placed
                        </TH>
                        <TH className="text-right">Total</TH>
                        <TH className="text-center">Status</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {c.orders.map((o, i) => (
                        <TR key={o.id}>
                          <TD className="tabular text-text-muted">{i + 1}</TD>
                          <TD>
                            <Ref href={`/app/orders/${o.id}`}>
                              {o.reference}
                            </Ref>
                          </TD>
                          <TD className="hidden whitespace-nowrap sm:table-cell">
                            {formatDateTime(o.createdAt, tz)}
                          </TD>
                          <TD numeric>{formatMoney(o.total, o.currency)}</TD>
                          <TD className="text-center">
                            <OrderTag
                              status={o.status}
                              isPaid={o.isPaid}
                              fulfilment={o.fulfilment}
                            />
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Part>

            <Part title="Quotations">
              {c.quotations.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No quotation requests.
                </p>
              ) : (
                <TableWrap label="Quotation requests from this customer">
                  <Table>
                    <THead>
                      <tr>
                        <TH className="w-16">No.</TH>
                        <TH className="text-left">Quotation</TH>
                        <TH className="hidden text-left sm:table-cell">
                          Requested
                        </TH>
                        <TH className="text-right">Quoted</TH>
                        <TH className="text-center">Status</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {c.quotations.map((m, i) => (
                        <TR key={m.id}>
                          <TD className="tabular text-text-muted">{i + 1}</TD>
                          <TD>
                            <Ref href={`/app/messages/${m.id}`}>
                              {quoteRef(m.reference)}
                            </Ref>
                          </TD>
                          <TD className="hidden whitespace-nowrap sm:table-cell">
                            {formatDateTime(m.createdAt, tz)}
                          </TD>
                          <TD numeric>
                            {m.quotedAmount
                              ? formatMoney(m.quotedAmount, business.currency)
                              : "—"}
                          </TD>
                          <TD className="text-center">
                            <QuoteTag
                              status={
                                isQuoteStatus(m.quoteStatus)
                                  ? m.quoteStatus
                                  : "requested"
                              }
                            />
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Part>

            <Part title="Enquiries">
              {c.enquiries.length === 0 ? (
                <p className="text-sm text-text-muted">No enquiries.</p>
              ) : (
                <TableWrap label="Enquiries from this customer">
                  <Table>
                    <THead>
                      <tr>
                        <TH className="w-16">No.</TH>
                        <TH className="text-left">Enquiry</TH>
                        <TH className="hidden text-left sm:table-cell">
                          Received
                        </TH>
                        <TH className="hidden text-left md:table-cell">
                          Message
                        </TH>
                        <TH className="text-center">Status</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {c.enquiries.map((m, i) => (
                        <TR key={m.id}>
                          <TD className="tabular text-text-muted">{i + 1}</TD>
                          <TD>
                            <Ref href={`/app/messages/${m.id}`}>
                              {m.reference}
                            </Ref>
                            <span className="mt-1 block text-xs text-text-muted">
                              {MESSAGE_KIND_LABEL[m.kind] ?? m.kind}
                            </span>
                          </TD>
                          <TD className="hidden whitespace-nowrap sm:table-cell">
                            {formatDateTime(m.createdAt, tz)}
                          </TD>
                          <TD className="hidden max-w-xs md:table-cell">
                            <span className="line-clamp-2">
                              {m.message ?? "—"}
                            </span>
                          </TD>
                          <TD className="text-center">
                            <EnquiryTag
                              state={m.isHandled ? "responded" : "new"}
                            />
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Part>
          </div>
        </section>
      </div>
    </>
  );
}
