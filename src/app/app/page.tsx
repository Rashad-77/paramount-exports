import { OrderTag, QuoteTag, EnquiryTag } from "@/components/app/tags";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { isQuoteStatus } from "@/lib/quotation-ui";
import { STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
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
          label="Orders in production"
          value={d.counts.in_progress}
          href="/app/orders?view=in_progress"
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
          label="Upcoming deliveries"
          value={d.upcomingDeliveriesCount}
          href="/app/delivery"
        />
        <Figure
          label="New enquiries"
          value={d.newEnquiries}
          href="/app/enquiries?state=new"
          attention={d.newEnquiries > 0}
        />
      </div>

      <div className="mt-8 grid min-w-0 items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Recent orders"
            actions={<More href="/app/orders">All orders</More>}
          >
            {d.recent.length === 0 ? (
              <p className="text-sm text-text-muted">
                No orders yet. Orders placed on the website will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recent.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/app/orders/${o.id}`}
                        className="font-medium text-walnut underline"
                      >
                        {o.reference}
                      </Link>
                      <p className="text-sm text-text-muted">
                        {o.customerName} ·{" "}
                        {formatDateTime(o.createdAt, business.timezone)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderTag status={o.status} />
                      <span className="text-sm font-medium">
                        {formatMoney(o.total, o.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent quotation requests"
            actions={<More href="/app/quotations">All quotations</More>}
          >
            {d.recentQuotes.length === 0 ? (
              <p className="text-sm text-text-muted">
                No quotation requests yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentQuotes.map((m) => {
                  const st = isQuoteStatus(m.quoteStatus)
                    ? m.quoteStatus
                    : "requested";
                  const what = (
                    m.payload as { furnitureType?: string | null } | null
                  )?.furnitureType;
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/app/messages/${m.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {m.reference}
                        </Link>
                        <p className="truncate text-sm text-text-muted">
                          {what ? `${what} · ` : ""}
                          {m.name}
                        </p>
                      </div>
                      <QuoteTag status={st} />
                    </li>
                  );
                })}
              </ul>
            )}
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
        <div className="min-w-0 space-y-6">
          <Panel
            title="Upcoming deliveries"
            actions={<More href="/app/delivery">All</More>}
          >
            {d.upcomingDeliveries.length === 0 ? (
              <p className="text-sm text-text-muted">No deliveries waiting.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.upcomingDeliveries.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/app/orders/${o.id}`}
                        className="font-medium text-walnut underline"
                      >
                        {o.reference}
                      </Link>
                      <p className="truncate text-sm text-text-muted">
                        {o.customerName}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">
                        {o.scheduledFor
                          ? formatDate(o.scheduledFor, "UTC")
                          : "Date not set"}
                      </p>
                      <p className="text-text-muted">
                        {STATUS_LABEL[o.status]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Recent customer enquiries"
            actions={<More href="/app/enquiries">All enquiries</More>}
          >
            {d.recentEnquiries.length === 0 ? (
              <p className="text-sm text-text-muted">No enquiries yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recentEnquiries.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/app/messages/${m.id}`}
                        className="font-medium text-walnut underline"
                      >
                        {m.reference}
                      </Link>
                      <p className="line-clamp-1 max-w-sm text-sm text-text-muted">
                        {m.name} · {m.message ?? "No message"}
                      </p>
                    </div>
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
