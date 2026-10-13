import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Inbox, PackageCheck, ShoppingBag, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { requireActor } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_TONE } from "@/lib/order-ui";
import { STATUS_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings, isPlaceholderBusiness } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getDashboard } from "@/server/orders";

export const metadata = { title: "Dashboard" };

function Kpi({ icon, label, value, hint, href, emphasis = false }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; href?: string; emphasis?: boolean }) {
  const body = (
    <div className={"flex h-full items-start gap-4 border p-4 shadow-[var(--shadow-sm)] " + (emphasis ? "border-brand bg-brand/5" : "border-border bg-surface")}>
      <span className="grid size-10 shrink-0 place-items-center bg-linen text-brand">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold leading-tight text-walnut">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full transition-colors hover:[&>div]:border-brand">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();
  const [business, d] = await Promise.all([getBusinessSettings(), getDashboard(actor)]);
  const open = d.counts.new + d.counts.confirmed + d.counts.in_progress;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.orders));
  const setup = [
    { label: "Business name", done: !isPlaceholderBusiness(business), hint: "Shown across the website." },
    { label: "Showroom address and opening hours", done: Boolean(business.address && business.openingHours), hint: "Shown on the Contact page." },
    { label: "Telephone or WhatsApp number", done: Boolean(business.phone || business.whatsapp), hint: "Customers call or message you from the website." },
    { label: "Bank details for transfers", done: Boolean(business.bankDetails), hint: "Shown to customers who choose to pay by bank transfer." },
  ];
  const missing = setup.filter((s) => !s.done);

  return (
    <>
      <PageHeader title="Dashboard" description="What needs doing today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<ShoppingBag aria-hidden="true" className="size-5" />} label="New orders" value={d.counts.new} hint={d.counts.new ? "Waiting to be confirmed" : "Nothing waiting"} href="/app/orders?status=new" emphasis={d.counts.new > 0} />
        <Kpi icon={<PackageCheck aria-hidden="true" className="size-5" />} label="Open orders" value={open} hint={`${d.counts.confirmed} confirmed · ${d.counts.in_progress} in progress`} href="/app/orders?status=open" />
        <Kpi icon={<Inbox aria-hidden="true" className="size-5" />} label="Messages to answer" value={d.unhandledMessages} href="/app/messages?state=open" emphasis={d.unhandledMessages > 0} />
        <Kpi icon={<Wallet aria-hidden="true" className="size-5" />} label="Ordered, last 30 days" value={formatMoney(d.last30.value, d.currency)} hint={`${d.last30.orders} ${d.last30.orders === 1 ? "order" : "orders"} · ${formatMoney(d.last30.paid, d.currency)} paid`} />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Recent orders"
            actions={
              <Link className="inline-flex items-center gap-1 text-sm underline" href="/app/orders">
                All orders <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          >
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

          <Panel title="Orders per day" description="The last 30 days, cancelled orders not counted.">
            <div role="img" aria-label={`Orders per day over the last 30 days: ${d.last30.orders} in total.`} className="flex h-32 items-end gap-1">
              {d.daily.map((x) => (
                <div key={x.day} className="flex h-full flex-1 items-end" title={`${x.day}: ${x.orders}`}>
                  <div className="w-full bg-brand/80" style={{ height: `${x.orders ? Math.max(6, (x.orders / maxDay) * 100) : 2}%`, opacity: x.orders ? 1 : 0.25 }} />
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
          <Panel title="Orders by status">
            <ul className="space-y-2 text-sm">
              {(["new", "confirmed", "in_progress", "delivered", "cancelled"] as const).map((s) => (
                <li key={s} className="flex items-center justify-between">
                  <Link href={`/app/orders?status=${s}`} className="underline">
                    {STATUS_LABEL[s]}
                  </Link>
                  <span className="font-medium">{d.counts[s]}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Set up your website" description={missing.length === 0 ? "Everything is filled in." : `${missing.length} of ${setup.length} still to do.`}>
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
            {missing.length > 0 ? (
              <Link href="/app/settings" className="mt-4 inline-flex items-center gap-1 text-sm underline">
                Open settings <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
