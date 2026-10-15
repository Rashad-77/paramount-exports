import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_TONE } from "@/lib/order-ui";
import { STAFF_QUOTE_LABEL, STAFF_QUOTE_TONE, isQuoteStatus } from "@/lib/quotation-ui";
import { STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getDashboard } from "@/server/orders";

export const metadata = { title: "Dashboard" };

/** One figure in the summary strip. A link when there is a list behind it. */
function Figure({ label, value, hint, href, attention = false }: { label: string; value: ReactNode; hint?: string; href?: string; attention?: boolean }) {
  const body = (
    <>
      <span className="dash-label">{label}</span>
      <strong className="dash-value" data-attention={attention ? "" : undefined}>
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
    <Link className="inline-flex items-center gap-1 text-sm underline" href={href}>
      {children} <ArrowRight aria-hidden="true" className="size-3.5" />
    </Link>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();
  const [business, d] = await Promise.all([getBusinessSettings(), getDashboard(actor)]);
  const maxDay = Math.max(1, ...d.daily.map((x) => x.orders));
  const setup = [
    { label: "Business name", done: !isPlaceholderBusiness(business), hint: "Shown across the website." },
    { label: "Showroom address and opening hours", done: Boolean(business.address && business.openingHours), hint: "Shown on the Contact page." },
    { label: "Telephone or WhatsApp number", done: Boolean(business.phone || business.whatsapp), hint: "Customers call or message you from the website." },
    { label: "Bank details for transfers", done: Boolean(business.bankDetails), hint: "Shown to customers who choose to pay by bank transfer." },
  ];
  const missing = setup.filter((s) => !s.done);
  const today = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: business.timezone }).format(new Date());

  return (
    <>
      <PageHeader title="Dashboard" description={`${today}. What needs doing today.`} />

      <div className="dash-grid">
        <Figure label="Total sales, last 30 days" value={formatMoney(d.last30.value, d.currency)} hint={`${d.last30.orders} ${d.last30.orders === 1 ? "order" : "orders"} · ${formatMoney(d.last30.paid, d.currency)} paid`} />
        <Figure label="New orders" value={d.counts.new} hint={d.counts.new ? "Waiting to be confirmed" : "Nothing waiting"} href="/app/orders?view=new" attention={d.counts.new > 0} />
        <Figure label="Pending quotations" value={d.pendingQuotations} hint={d.pendingQuotations ? "Waiting for a price" : "Nothing waiting"} href="/app/quotations?status=requested" attention={d.pendingQuotations > 0} />
        <Figure label="Orders in production" value={d.counts.in_progress} hint={`${d.counts.confirmed} confirmed, not started`} href="/app/orders?view=in_progress" />
        <Figure label="Ready for collection or delivery" value={d.counts.ready + d.counts.out_for_delivery} hint={`${d.counts.out_for_delivery} out for delivery`} href="/app/orders?view=ready" />
        <Figure label="Awaiting payment" value={d.awaitingPayment} hint="Orders not marked as paid" href="/app/orders?view=unpaid" />
        <Figure label="Upcoming deliveries" value={d.upcomingDeliveriesCount} hint="Delivery orders not yet completed" href="/app/delivery" />
        <Figure label="New enquiries" value={d.newEnquiries} hint={d.newEnquiries ? "Waiting for an answer" : "All answered"} href="/app/enquiries?state=new" attention={d.newEnquiries > 0} />
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Recent orders" actions={<More href="/app/orders">All orders</More>}>
          {d.recent.length === 0 ? (
            <p className="text-sm text-text-muted">No orders yet. Orders placed on the website will appear here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recent.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/app/orders/${o.id}`} className="font-medium text-walnut underline">
                      {o.reference}
                    </Link>
                    <p className="text-sm text-text-muted">
                      {o.customerName} · {formatDateTime(o.createdAt, business.timezone)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</StatusBadge>
                    <span className="text-sm font-medium">{formatMoney(o.total, o.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming deliveries" actions={<More href="/app/delivery">All</More>}>
          {d.upcomingDeliveries.length === 0 ? (
            <p className="text-sm text-text-muted">No deliveries waiting.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.upcomingDeliveries.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/app/orders/${o.id}`} className="font-medium text-walnut underline">
                      {o.reference}
                    </Link>
                    <p className="truncate text-sm text-text-muted">{o.customerName}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{o.scheduledFor ? formatDate(o.scheduledFor, "UTC") : "Date not set"}</p>
                    <p className="text-text-muted">{STATUS_LABEL[o.status]}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent quotation requests" actions={<More href="/app/quotations">All quotations</More>}>
          {d.recentQuotes.length === 0 ? (
            <p className="text-sm text-text-muted">No quotation requests yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentQuotes.map((m) => {
                const st = isQuoteStatus(m.quoteStatus) ? m.quoteStatus : "requested";
                const what = (m.payload as { furnitureType?: string | null } | null)?.furnitureType;
                return (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/app/messages/${m.id}`} className="font-medium text-walnut underline">
                        {m.reference}
                      </Link>
                      <p className="truncate text-sm text-text-muted">
                        {what ? `${what} · ` : ""}
                        {m.name}
                      </p>
                    </div>
                    <StatusBadge tone={STAFF_QUOTE_TONE[st]}>{STAFF_QUOTE_LABEL[st]}</StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent customer enquiries" actions={<More href="/app/enquiries">All enquiries</More>}>
          {d.recentEnquiries.length === 0 ? (
            <p className="text-sm text-text-muted">No enquiries yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentEnquiries.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/app/messages/${m.id}`} className="font-medium text-walnut underline">
                      {m.reference}
                    </Link>
                    <p className="line-clamp-1 max-w-sm text-sm text-text-muted">
                      {m.name} · {m.message ?? "No message"}
                    </p>
                  </div>
                  {m.isHandled ? <StatusBadge tone="success">Responded</StatusBadge> : m.inProgress ? <StatusBadge tone="warning">In progress</StatusBadge> : <StatusBadge tone="info">New</StatusBadge>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Orders per day" description="The last 30 days, cancelled orders not counted.">
          <div role="img" aria-label={`Orders per day over the last 30 days: ${d.last30.orders} in total.`} className="flex h-28 items-end gap-1">
            {d.daily.map((x) => (
              <div key={x.day} className="flex h-full flex-1 items-end" title={`${x.day}: ${x.orders}`}>
                <div className="w-full bg-walnut" style={{ height: `${x.orders ? Math.max(6, (x.orders / maxDay) * 100) : 2}%`, opacity: x.orders ? 0.85 : 0.18 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-text-muted">
            <span>{d.daily[0]?.day}</span>
            <span>Today</span>
          </div>
        </Panel>

        {missing.length > 0 ? (
          <Panel title="Set up your website" description={`${missing.length} of ${setup.length} still to do.`}>
            <ul className="space-y-3 text-sm">
              {setup.map((s) => (
                <li key={s.label} className="flex gap-2.5">
                  {s.done ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" /> : <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />}
                  <span>
                    <span className={s.done ? "text-text-muted line-through" : "font-medium"}>{s.label}</span>
                    {s.done ? null : <span className="block text-text-muted">{s.hint}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <More href="/app/settings">Open settings</More>
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
