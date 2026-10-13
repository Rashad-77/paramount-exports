"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { trackOrderAction } from "@/app/(public)/track-actions";
import { ActionForm, FField, SubmitButton, useFormState } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/status";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { dec, formatMoney } from "@/lib/money";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-constants";
import type { TrackedOrder } from "@/lib/schemas/tracking";
import { formatDateTime } from "@/lib/time";

/** The steps a customer sees, in order. "Being prepared" has no time of its own: staff only stamp the other three. */
function stepsFor(o: TrackedOrder) {
  const delivery = o.fulfilment === "delivery";
  return [
    { key: "new", label: "Order received", at: o.placedAt, note: "We have your order. We will call or message you to confirm it." },
    {
      key: "confirmed",
      label: "Order confirmed",
      at: o.confirmedAt,
      note: delivery ? "Your order is confirmed. We will arrange the delivery charge and the day with you." : "Your order is confirmed. We will tell you when it is ready to collect.",
    },
    { key: "in_progress", label: "Being prepared", at: null, note: "We are preparing your order." },
    { key: "delivered", label: delivery ? "Delivered" : "Collected", at: o.deliveredAt, note: delivery ? "Your order has been delivered. Thank you." : "Your order has been collected. Thank you." },
  ] as const;
}
const ORDER = ["new", "confirmed", "in_progress", "delivered"] as const;

function Result({ timezone, phone }: { timezone: string; phone: string | null }) {
  const { state } = useFormState();
  if (!state.ok) return null;
  const o = state.data as TrackedOrder | null | undefined;
  if (!o) {
    return (
      <Alert tone="danger" className="mt-8">
        We could not find an order with that number and phone number. Please check them and try again, or contact us.
      </Alert>
    );
  }

  return <OrderView o={o} timezone={timezone} phone={phone} />;
}

/** One order as its own customer sees it. Used by the number-and-phone lookup and by the signed-in account pages. */
export function OrderView({ o, timezone, phone }: { o: TrackedOrder; timezone: string; phone: string | null }) {
  const when = (iso: string | null) => (iso ? formatDateTime(iso, timezone) : null);
  const steps = stepsFor(o);
  const at = o.status === "cancelled" ? -1 : ORDER.indexOf(o.status);
  const awaitingCharge = o.fulfilment === "delivery" && dec(o.deliveryCharge).isZero() && at < 1;

  return (
    <section aria-labelledby="track-result" className="mt-10 space-y-6" aria-live="polite">
      <div>
        <p className="eyebrow">Order {o.reference}</p>
        <h2 id="track-result" className="font-display mt-3 text-[1.9rem] leading-tight text-text">
          {o.firstName ? `Hello ${o.firstName}, here is your order.` : "Here is your order."}
        </h2>
        <p className="mt-2 text-[0.8125rem] text-text-muted">Placed {when(o.placedAt)}</p>
      </div>

      {o.status === "cancelled" ? (
        <Alert tone="danger" title="This order was cancelled">
          {o.cancelledAt ? `Cancelled ${when(o.cancelledAt)}. ` : null}If you have a question about it, please contact us and quote {o.reference}.
        </Alert>
      ) : (
        <ol className="track-steps soft-card">
          {steps.map((s, i) => {
            const state = i < at ? "done" : i === at ? "now" : "next";
            return (
              <li key={s.key} data-state={state} aria-current={state === "now" ? "step" : undefined}>
                <span className="track-dot" aria-hidden="true">
                  {state === "done" || (state === "now" && o.status === "delivered") ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                </span>
                <div>
                  <p className="track-label">
                    {s.label}
                    {state === "now" ? <span className="sr-only"> (current step)</span> : null}
                  </p>
                  {s.at ? <p className="track-when">{when(s.at)}</p> : null}
                  {state === "now" ? <p className="track-note">{s.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="soft-card">
        <h3 className="font-display text-[1.2rem] leading-tight text-text">What you ordered</h3>
        <ul className="mt-4 divide-y divide-border text-[0.875rem]">
          {o.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-4 py-3">
              <span>
                {i.quantity} × {i.name}
                {i.label ? <span className="text-text-muted"> · {i.label}</span> : null}
              </span>
              <span className="shrink-0">{formatMoney(i.lineTotal, o.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[0.875rem]">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Items</dt>
            <dd>{formatMoney(o.subtotal, o.currency)}</dd>
          </div>
          {o.fulfilment === "delivery" ? (
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Delivery</dt>
              <dd>{awaitingCharge ? "Agreed when we confirm" : formatMoney(o.deliveryCharge, o.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 pt-1 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(o.total, o.currency)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="soft-card">
          <p className="eyebrow">How</p>
          <p className="mt-3 text-[0.9375rem] text-text">{FULFILMENT_LABEL[o.fulfilment]}</p>
        </div>
        <div className="soft-card">
          <p className="eyebrow">Payment</p>
          <p className="mt-3 text-[0.9375rem] text-text">
            {PAYMENT_LABEL[o.paymentMethod]}
            <span className="text-text-muted"> · {o.isPaid ? "received, thank you" : "not yet received"}</span>
          </p>
        </div>
      </div>

      <p className="text-[0.875rem] text-text-muted">
        Need to change something? {phone ? <a href={`tel:${phone.replace(/\s+/g, "")}`} className="text-text underline">Call us on {phone}</a> : <Link href="/contact" className="text-text underline">Contact us</Link>} and quote {o.reference}.
      </p>
    </section>
  );
}

/** "Where is my order?" for visitors: the order number and the phone number used when ordering. No account is needed. */
export function TrackOrder({ initialReference, timezone, phone }: { initialReference?: string; timezone: string; phone: string | null }) {
  return (
    <ActionForm action={trackOrderAction}>
      {/* Honeypot: visually hidden and skipped by keyboard and screen readers; humans never fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="soft-card space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FField name="reference" label="Order number" placeholder="ORD-000123" defaultValue={initialReference} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required hint="It is on your confirmation page." />
          <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required hint="The number you gave when you ordered." />
        </div>
        <SubmitButton size="cta" pendingLabel="Looking…">
          Track order
        </SubmitButton>
      </div>
      <Result timezone={timezone} phone={phone} />
    </ActionForm>
  );
}
