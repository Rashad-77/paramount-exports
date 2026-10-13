"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import { placeOrderAction } from "@/app/(public)/order-actions";
import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ButtonLink } from "@/components/ui/button";
import { saveSnapshot, useCart } from "@/lib/cart";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { dec, formatMoney } from "@/lib/money";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type Fulfilment, type PaymentMethod } from "@/lib/order-constants";

const PAYMENTS_FOR: Record<Fulfilment, PaymentMethod[]> = {
  delivery: ["on_delivery", "bank_transfer"],
  pickup: ["at_showroom", "bank_transfer"],
};
const PAYMENT_HELP: Record<PaymentMethod, string> = {
  on_delivery: "Pay the person who delivers your order, in cash.",
  bank_transfer: "Transfer the amount to our bank account once we have confirmed your order.",
  at_showroom: "Pay when you collect your order from the showroom.",
};

function Choice({ name, value, checked, onChange, title, help }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; help?: string }) {
  return (
    <label className={"flex cursor-pointer gap-3 border p-4 transition-colors " + (checked ? "border-brand bg-brand/5" : "border-border-strong hover:border-brand")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 size-4 accent-[var(--color-brand)]" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        {help ? <span className="mt-0.5 block text-sm text-text-muted">{help}</span> : null}
      </span>
    </label>
  );
}

/**
 * The checkout: who you are, how you want it (delivery or collection), and how you plan to pay. Nothing is charged here. The basket
 * travels as ids and quantities only; the server prices it. Anti-spam: honeypot, signed time-stamped token, optional Turnstile.
 */
export function CheckoutForm({ currency, bankDetails, turnstileSiteKey }: { currency: string; bankDetails: string | null; turnstileSiteKey?: string }) {
  const { items, subtotal } = useCart();
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [payment, setPayment] = useState<PaymentMethod>("on_delivery");
  const [token, setToken] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { token: string }) => alive && setToken(j.token))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Keep what is needed for the confirmation page, which is shown after the basket has been emptied.
  useEffect(() => {
    if (items.length) saveSnapshot({ items: items.map((i) => ({ productName: i.productName, variantLabel: i.variantLabel, price: i.price, quantity: i.quantity })), subtotal, currency });
  }, [items, subtotal, currency]);

  const chooseFulfilment = (f: Fulfilment) => {
    setFulfilment(f);
    if (!PAYMENTS_FOR[f].includes(payment)) setPayment(PAYMENTS_FOR[f][0]!);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="font-display text-[1.75rem] leading-tight text-brand">Your cart is empty</h2>
        <p className="mt-2 text-text-muted">Add a piece to your order first.</p>
        <ButtonLink href="/products" size="cta" className="mt-6">
          Browse the collection
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <ActionForm action={placeOrderAction}>
        {turnstileSiteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" /> : null}
        <input type="hidden" name="formToken" value={token} />
        <input type="hidden" name="cart" value={JSON.stringify(items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })))} />
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Leave this field empty
            <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <fieldset className="space-y-5">
          <legend className="font-display text-[1.5rem] leading-tight text-brand">Your details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <FField name="name" label="Your name" autoComplete="name" maxLength={120} required />
            <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required hint="We call or message you on this number to confirm." />
            <FField name="email" label="Email" type="email" autoComplete="email" inputMode="email" maxLength={200} className="sm:col-span-2" />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-display mb-2 text-[1.5rem] leading-tight text-brand">How would you like it?</legend>
          {(["delivery", "pickup"] as const).map((f) => (
            <Choice
              key={f}
              name="fulfilment"
              value={f}
              checked={fulfilment === f}
              onChange={() => chooseFulfilment(f)}
              title={FULFILMENT_LABEL[f]}
              help={f === "delivery" ? "We deliver to your address. The delivery charge is agreed with you when we confirm." : "Collect it from our showroom. No delivery charge."}
            />
          ))}
          {fulfilment === "delivery" ? <FTextArea name="address" label="Delivery address" rows={3} maxLength={400} required autoComplete="street-address" /> : null}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-display mb-2 text-[1.5rem] leading-tight text-brand">How will you pay?</legend>
          <p className="text-sm text-text-muted">There is no payment on this website. Choose how you plan to pay and we will confirm with you.</p>
          {PAYMENTS_FOR[fulfilment].map((p) => (
            <Choice key={p} name="paymentMethod" value={p} checked={payment === p} onChange={() => setPayment(p)} title={PAYMENT_LABEL[p]} help={PAYMENT_HELP[p]} />
          ))}
          {payment === "bank_transfer" ? (
            <div className="border border-border bg-linen p-4 text-sm">
              {bankDetails ? (
                <>
                  <p className="font-medium">Our bank details</p>
                  <p className="mt-1 whitespace-pre-line">{bankDetails}</p>
                  <p className="mt-2 text-text-muted">Please wait until we have confirmed your order before you transfer.</p>
                </>
              ) : (
                <p>We will send you our bank details when we confirm your order.</p>
              )}
            </div>
          ) : null}
        </fieldset>

        <FTextArea name="note" label="Anything we should know?" rows={3} maxLength={1000} hint="For example the best time to call, or access to your building." />
        {turnstileSiteKey ? <div className="cf-turnstile" data-sitekey={turnstileSiteKey} /> : null}
        <FCheckbox name="consent" label="I agree to be contacted about this order." hint="We use your details only for this order. See the Privacy notice." />
        <SubmitButton size="cta" pendingLabel="Placing your order…">
          Place order
        </SubmitButton>
      </ActionForm>

      <aside aria-labelledby="checkout-summary" className="border border-border bg-surface p-6 lg:sticky lg:top-28">
        <h2 id="checkout-summary" className="font-display text-[1.5rem] leading-tight text-brand">
          Your order
        </h2>
        <ul className="mt-4 divide-y divide-border text-sm">
          {items.map((i) => (
            <li key={i.variantId} className="flex justify-between gap-3 py-3 first:pt-0">
              <span>
                <span className="font-medium">{i.productName}</span>
                {i.variantLabel ? <span className="text-text-muted"> · {i.variantLabel}</span> : null}
                <span className="block text-text-muted">Quantity {i.quantity}</span>
              </span>
              <span className="shrink-0 font-medium">{formatMoney(dec(i.price).times(i.quantity), currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Delivery</dt>
            <dd>{fulfilment === "pickup" ? "None" : "Agreed with you"}</dd>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <dt>Total so far</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-text-muted">Nothing is charged now.</p>
        <p className="mt-3 text-sm">
          <Link href="/cart" className="underline">
            Change your order
          </Link>
        </p>
      </aside>
    </div>
  );
}
