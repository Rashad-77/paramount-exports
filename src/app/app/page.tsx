import { OrderTag, EnquiryTag } from "@/components/app/tags";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, Panel } from "@/components/ui/page-header";
import {
  EmptyRow,
  Table,
  TableWrap,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { quoteRef } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getDashboard } from "@/server/orders";

export const metadata = { title: "Dashboard" };

/** One figure in the summary strip. A link when there is a list behind it. */
function Figure({
  label,
  value,
  hint,
  href,
  attention = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
  attention?: boolean;
}) {
  const body = (
    <>
      <span className="dash-label">{label}</span>
      <strong
        className="dash-value"
        data-attention={attention ? "" : undefined}
      >
        {value}
      </strong>
      {hint ? <span className="dash-hint">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="dash-figure">
      {body}
    </Link>
  ) : (
    <div className="dash-figure">{body}</div>
  );
}

function More({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      className="inline-flex items-center gap-1 text-sm underline"
      href={href}
    >
      {children} <ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();
  const [business, d] = await Promise.all([
    getBusinessSettings(),
    getDashboard(actor),
  ]);
  const maxDay = Math.max(1, ...d.daily.map((x) => x.orders));
  const today = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: business.timezone,
  }).format(new Date());

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${today}. What needs doing today.`}
      />

      <div className="dash-grid">
        <Figure
          label="Total sales, last 30 days"
          value={formatMoney(d.last30.value, d.currency)}
          hint={`${d.last30.orders} ${d.last30.orders === 1 ? "order" : "orders"} · ${formatMoney(d.last30.paid, d.currency)} paid`}
        />
        <Figure
          label="New orders"
          value={d.counts.new}
          href="/app/orders?view=new"
          attention={d.counts.new > 0}
        />
        <Figure
          label="Pending quotations"
          value={d.pendingQuotations}
          href="/app/quotations?status=requested"
          attention={d.pendingQuotations > 0}
        />
        <Figure
          label="Ready for collection or delivery"
          value={d.counts.ready + d.counts.out_for_delivery}
          href="/app/orders?view=ready"
        />
        <Figure
          label="Awaiting payment"
          value={d.awaitingPayment}
          href="/app/orders?view=unpaid"
        />
        <Figure
          label="New enquiries"
          value={d.newEnquiries}
          href="/app/enquiries?state=new"
          attention={d.newEnquiries > 0}
        />
      </div>

      <div className="mt-8 min-w-0">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Recent orders"
            actions={<More href="/app/orders">All orders</More>}
          >
            <TableWrap label="Recent orders">
              <Table>
                <THead>
                  <tr>
                    <TH>Order</TH>
                    <TH>Customer</TH>
                    <TH>Placed</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {d.recent.length === 0 ? (
                    <EmptyRow
                      colSpan={4}
                      title="No orders yet"
                      description="Orders placed on the website will appear here."
                    />
                  ) : null}
                  {d.recent.map((o) => (
                    <TR key={o.id}>
                      <TD className="text-center">
                        <Link
                          href={`/app/orders/${o.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {o.reference}
                        </Link>
                      </TD>
                      <TD className="text-center">{o.customerName}</TD>
                      <TD className="text-center text-text-muted">
                        {formatDateTime(o.createdAt, business.timezone)}
                      </TD>
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
          </Panel>

          <Panel
            title="Recent quotation requests"
            actions={<More href="/app/quotations">All quotations</More>}
          >
            <TableWrap label="Recent quotation requests">
              <Table>
                <THead>
                  <tr>
                    <TH>Request</TH>
                    <TH>Piece</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {d.recentQuotes.length === 0 ? (
                    <EmptyRow
                      colSpan={4}
                      title="No quotation requests yet"
                      description="Made-to-measure requests from the website will appear here."
                    />
                  ) : null}
                  {d.recentQuotes.map((m) => {
                    const what = (
                      m.payload as { furnitureType?: string | null } | null
                    )?.furnitureType;
                    return (
                      <TR key={m.id}>
                        <TD className="text-center">
                          <Link
                            href={`/app/messages/${m.id}`}
                            className="font-medium text-walnut underline"
                          >
                            {quoteRef(m.reference)}
                          </Link>
                        </TD>
                        <TD className="text-center">{what ?? "—"}</TD>
                        <TD className="text-center">{m.name}</TD>
                        <TD className="text-center">
                          <EnquiryTag
                            state={m.isHandled ? "responded" : "new"}
                          />
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </Panel>

          <Panel
            title="Recent customer enquiries"
            actions={<More href="/app/enquiries">All enquiries</More>}
          >
            <TableWrap label="Recent customer enquiries">
              <Table>
                <THead>
                  <tr>
                    <TH>Enquiry</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {d.recentEnquiries.length === 0 ? (
                    <EmptyRow
                      colSpan={3}
                      title="No enquiries yet"
                      description="Messages from the contact form and product pages will appear here."
                    />
                  ) : null}
                  {d.recentEnquiries.map((m) => (
                    <TR key={m.id}>
                      <TD className="text-center">
                        <Link
                          href={`/app/messages/${m.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {m.reference}
                        </Link>
                        <p className="mx-auto line-clamp-1 max-w-[12rem] text-text-muted">
                          {m.message ?? "No message"}
                        </p>
                      </TD>
                      <TD className="text-center">{m.name}</TD>
                      <TD className="text-center">
                        {m.isHandled ? (
                          <EnquiryTag state="responded" />
                        ) : (
                          <EnquiryTag state="new" />
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Panel>

          <Panel
            title="Orders per day"
            description="The last 30 days, cancelled orders not counted."
          >
            <div
              role="img"
              aria-label={`Orders per day over the last 30 days: ${d.last30.orders} in total.`}
              className="flex h-28 items-end gap-1"
            >
              {d.daily.map((x) => (
                <div
                  key={x.day}
                  className="flex h-full flex-1 items-end"
                  title={`${x.day}: ${x.orders}`}
                >
                  <div
                    className="w-full bg-walnut"
                    style={{
                      height: `${x.orders ? Math.max(6, (x.orders / maxDay) * 100) : 2}%`,
                      opacity: x.orders ? 0.85 : 0.18,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-text-muted">
              <span>{d.daily[0]?.day}</span>
              <span>Today</span>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
