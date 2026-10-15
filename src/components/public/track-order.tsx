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
import { Alert } from "@/components/ui/status";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { dec, formatMoney } from "@/lib/money";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-constants";
import type { TrackedOrder } from "@/lib/schemas/tracking";
import { formatDate, formatDateTime } from "@/lib/time";

/** The steps a customer sees, in order. "Being prepared" has no time of its own: staff only stamp the other three. */
function stepsFor(o: TrackedOrder) {
  const delivery = o.fulfilment === "delivery";
  return [
    {
      key: "new",
      label: "Order received",
      at: o.placedAt,
      note: "We have your order. We will call or message you to confirm it.",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      at: o.confirmedAt,
      note: delivery
        ? "Your order is confirmed. We will arrange the delivery charge and the day with you."
        : "Your order is confirmed. We will tell you when it is ready to collect.",
    },
    {
      key: "in_progress",
      label: "Being prepared",
      at: null,
      note: "We are preparing your order.",
    },
    {
      key: "delivered",
      label: delivery ? "Delivered" : "Collected",
      at: o.deliveredAt,
      note: delivery
        ? "Your order has been delivered. Thank you."
        : "Your order has been collected. Thank you.",
    },
  ] as const;
}
const ORDER = ["new", "confirmed", "in_progress", "delivered"] as const;

function Result({
  timezone,
  phone,
}: {
  timezone: string;
  phone: string | null;
}) {
  const { state } = useFormState();
  if (!state.ok) return null;
  const o = state.data as TrackedOrder | null | undefined;
  if (!o) {
    return (
      <Alert tone="danger" className="mt-8">
        We could not find an order with that number and phone number. Please
        check them and try again, or contact us.
      </Alert>
    );
  }

  return <OrderView o={o} timezone={timezone} phone={phone} />;
}

/** One order as its own customer sees it. Used by the number-and-phone lookup and by the signed-in account pages. */
export function OrderView({
  o,
  timezone,
  phone,
}: {
  o: TrackedOrder;
  timezone: string;
  phone: string | null;
}) {
  const when = (iso: string | null) =>
    iso ? formatDateTime(iso, timezone) : null;
  const steps = stepsFor(o);
  const at = o.status === "cancelled" ? -1 : ORDER.indexOf(o.status);
  const awaitingCharge =
    o.fulfilment === "delivery" && dec(o.deliveryCharge).isZero() && at < 1;
  const current = steps[Math.max(0, at)]!;

  return (
    <section
      aria-labelledby="track-result"
      className="ot mt-10"
      aria-live="polite"
    >
      <h2 id="track-result" className="font-display ot-hello">
        {o.firstName
          ? `Hello ${o.firstName}, here is your order.`
          : "Here is your order."}
      </h2>

      <div className="ot-card">
        <div className="ot-head">
          <div>
            <p className="ot-kicker">Order</p>
            <p className="ot-ref">{o.reference}</p>
            <p className="ot-sub">Placed {when(o.placedAt)}</p>
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
          <ul className="ot-items">
            {o.items.map((i, n) => (
              <li key={n}>
                <span>
                  <span className="ot-name">{i.name}</span>
                  {i.label ? (
                    <span className="ot-muted"> · {i.label}</span>
                  ) : null}
                  <span className="ot-muted ot-qty">Qty {i.quantity}</span>
                </span>
                <span className="ot-money">
                  {formatMoney(i.lineTotal, o.currency)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="ot-sum">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(o.subtotal, o.currency)}</dd>
            </div>
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
        Need to change something?{" "}
        {phone ? (
          <a href={`tel:${phone.replace(/\s+/g, "")}`}>Call us on {phone}</a>
        ) : (
          <Link href="/contact">Contact us</Link>
        )}{" "}
        and quote {o.reference}.
      </p>
    </section>
  );
}

/** "Where is my order?" for visitors: the order number and the phone number used when ordering. No account is needed. */
export function TrackOrder({
  initialReference,
  timezone,
  phone,
}: {
  initialReference?: string;
  timezone: string;
  phone: string | null;
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
        <div className="grid gap-5 sm:grid-cols-2">
          <FField
            name="reference"
            label="Order number"
            placeholder="ORD-000123"
            defaultValue={initialReference}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={30}
            required
            hint="It is on your confirmation page."
          />
          <FField
            name="phone"
            label="Phone number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            required
            hint="The number you gave when you ordered."
          />
        </div>
        <SubmitButton size="cta" pendingLabel="Looking…">
          Track order
        </SubmitButton>
      </div>
      <Result timezone={timezone} phone={phone} />
    </ActionForm>
  );
}
