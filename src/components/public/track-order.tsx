"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { trackOrderAction } from "@/app/(public)/track-actions";
import {
  ActionForm,
  FField,
  SubmitButton,
  useFormState,
} from "@/components/forms/action-form";
import { OrderStatusPill } from "@/components/public/account-ui";
import { SiteImage } from "@/components/public/site-image";
import { Alert } from "@/components/ui/status";
import { ToastOnMount } from "@/components/ui/toaster";
import { orderNumber } from "@/lib/schemas/tracking";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { dec, formatMoney } from "@/lib/money";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-constants";
import type { OrderStatus } from "@/lib/order-constants";
import type { TrackedOrder } from "@/lib/schemas/tracking";
import { formatDate, formatDateTime } from "@/lib/time";

/** The customer-facing milestones shown in the order tracker. */
function stepsFor(o: TrackedOrder) {
  const delivery = o.fulfilment === "delivery";
  const planned = o.scheduledFor ? ` Planned for ${formatDate(o.scheduledFor, "UTC")}.` : "";
  const steps: Array<{ key: OrderStatus; label: string; at: string | null; note: string }> = [
    { key: "new", label: "Order received", at: o.placedAt, note: "We have your order. We will call or message you to confirm it." },
    {
      key: "confirmed",
      label: "Confirmed",
      at: o.confirmedAt,
      note: delivery ? "Your order is confirmed. We will arrange the delivery charge and the day with you." : "Your order is confirmed. We will tell you when it is ready to collect.",
    },
    { key: "ready", label: "Ready", at: o.readyAt, note: (delivery ? "Your order is ready and will be sent out soon." : "Your order is ready. You can collect it from the showroom.") + planned },
  ];
  return steps;
}

function Result({ timezone }: { timezone: string }) {
  const { state } = useFormState();
  if (!state.ok) return null;
  const o = state.data as TrackedOrder | null | undefined;
  if (!o) {
    return <ToastOnMount tone="danger" message="We could not find an order with that number. Please check it and try again, or contact us." />;
  }

  return <OrderView o={o} timezone={timezone} />;
}

/** One order as its own customer sees it. Used by the order-number lookup and by the signed-in account pages. */
export function OrderView({
  o,
  timezone,
}: {
  o: TrackedOrder;
  timezone: string;
}) {
  const when = (iso: string | null) =>
    iso ? formatDateTime(iso, timezone) : null;
  const steps = stepsFor(o);
  const at = o.status === "cancelled"
    ? -1
    : o.status === "delivered"
      ? steps.length
      : o.status === "in_progress"
        ? steps.findIndex((st) => st.key === "confirmed")
        : steps.findIndex((st) => st.key === o.status);
  const awaitingCharge =
    o.fulfilment === "delivery" && dec(o.deliveryCharge).isZero() && at < 1;
  const current = o.status === "delivered"
    ? { note: o.fulfilment === "delivery" ? "Your order has been delivered. Thank you." : "Your order has been collected. Thank you." }
    : steps[Math.max(0, Math.min(at, steps.length - 1))]!;
  // Anything the total is short of the sum of the items and the delivery charge is a discount.
  const discount = dec(o.subtotal)
    .plus(dec(o.deliveryCharge))
    .minus(dec(o.total));

  return (
    <section
      aria-labelledby="track-result"
      className="ot mt-10"
      aria-live="polite"
    >
      <h2 id="track-result" className="sr-only">
        {o.firstName
          ? `Hello ${o.firstName}, here is your order.`
          : "Here is your order."}
      </h2>

      <div className="ot-card">
        <div className="ot-head">
          <div>
            <p className="ot-kicker">Order</p>
            <p className="ot-ref">{orderNumber(o.reference)}</p>
            <p className="ot-sub">Placed {when(o.placedAt)}</p>
            <p className="ot-sub">
              <a href={o.receiptUrl} target="_blank" rel="noopener" className="underline">
                {o.isPaid ? "Print or save your receipt" : "Print or save your invoice"}
              </a>
            </p>
          </div>
          <OrderStatusPill status={o.status} />
        </div>

        {o.status === "cancelled" ? (
          <Alert tone="danger" title="This order was cancelled">
            {o.cancelledAt ? `Cancelled ${when(o.cancelledAt)}. ` : null}If you
            have a question about it, please contact us and quote {o.reference}.
          </Alert>
        ) : (
          <>
            <ol className="ot-bar" aria-label="Where your order is">
              {steps.map((st, i) => {
                const state = i < at ? "done" : i === at ? "now" : "next";
                return (
                  <li
                    key={st.key}
                    data-state={state}
                    aria-current={state === "now" ? "step" : undefined}
                  >
                    <span className="ot-dot" aria-hidden="true">
                      {state === "done" ||
                      (state === "now" && o.status === "delivered") ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="ot-step">
                      {st.label}
                      {state === "now" ? (
                        <span className="sr-only"> (current step)</span>
                      ) : null}
                    </span>
                    {st.at && i <= at ? (
                      <span className="ot-when">
                        {formatDate(st.at, timezone)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <p className="ot-note">{current.note}</p>
          </>
        )}

        <dl className="ot-facts">
          <div>
            <dt>Delivery or collection</dt>
            <dd>{FULFILMENT_LABEL[o.fulfilment]}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd>
              {PAYMENT_LABEL[o.paymentMethod]}
              <span className="ot-muted">
                {" "}
                · {o.isPaid ? "received, thank you" : "not yet received"}
              </span>
            </dd>
          </div>
        </dl>

        <div className="ot-summary">
          <h3 className="ot-h">Order summary</h3>
          {o.items.map((i, n) => (
            <div key={n} className="ot-piece">
              <div className="ot-item">
                <span
                  className="ot-thumb"
                  aria-hidden={i.imageUrl ? undefined : "true"}
                >
                  {i.imageUrl ? (
                    <SiteImage
                      src={i.imageUrl}
                      alt={i.imageAlt}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : null}
                </span>
                <span className="ot-name">
                  {i.name}
                  {i.label ? (
                    <span className="ot-muted"> · {i.label}</span>
                  ) : null}
                </span>
              </div>
              <dl className="ot-sum">
                <div>
                  <dt>
                    {i.quantity > 1 ? `Price (Qty ${i.quantity})` : "Price"}
                  </dt>
                  <dd>{formatMoney(i.lineTotal, o.currency)}</dd>
                </div>
              </dl>
            </div>
          ))}
          <dl className="ot-sum ot-sum-end">
            {discount.gt(0) ? (
              <div>
                <dt>Discount</dt>
                <dd>− {formatMoney(discount, o.currency)}</dd>
              </div>
            ) : null}
            {o.fulfilment === "delivery" ? (
              <div>
                <dt>Delivery</dt>
                <dd>
                  {awaitingCharge
                    ? "Confirmed after your order"
                    : formatMoney(o.deliveryCharge, o.currency)}
                </dd>
              </div>
            ) : null}
            <div className="ot-sum-total">
              <dt>
                {o.fulfilment === "delivery" && awaitingCharge
                  ? "Total (excl. delivery)"
                  : "Total"}
              </dt>
              <dd>{formatMoney(o.total, o.currency)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="ot-help">
        Need to make an adjustment or ask for a refund? <Link href="/contact">Contact us</Link>
      </p>
    </section>
  );
}

/** "Where is my order?" for visitors: the order number. No account is needed. */
export function TrackOrder({
  initialReference,
  timezone,
}: {
  initialReference?: string;
  timezone: string;
}) {
  return (
    <ActionForm action={trackOrderAction}>
      {/* Honeypot: visually hidden and skipped by keyboard and screen readers; humans never fill it. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label>
          Leave this field empty
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
          />
        </label>
      </div>
      <div className="soft-card space-y-5">
        <div className="grid gap-5">
          <FField
            name="reference"
            label="Order number"
            placeholder="482719366"
            inputMode="numeric"
            defaultValue={initialReference}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={30}
            required
            hint="Your order number can be found on the order confirmation page shown after you place your order."
          />
        </div>
        <div className="flex justify-center">
          <SubmitButton size="cta" pendingLabel="Looking…">
            Track order
          </SubmitButton>
        </div>
      </div>
      <Result timezone={timezone} />
    </ActionForm>
  );
}
