"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { ButtonLink } from "@/components/ui/button";
import { dropSnapshot, useCart, useLastOrder } from "@/lib/cart";
import { dec, formatMoney } from "@/lib/money";
import { orderNumber } from "@/lib/schemas/tracking";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type Fulfilment, type PaymentMethod } from "@/lib/order-constants";

/** Shown after an order is placed. The basket is emptied here, once the page has loaded. */
export function OrderConfirmed({ reference, payment, fulfilment, bankDetails, phone }: { reference: string | null; payment: PaymentMethod | null; fulfilment: Fulfilment | null; bankDetails: string | null; phone: string | null }) {
  const { clear } = useCart();
  const snap = useLastOrder();

  // The summary above is read before this runs; now the basket and the stored copy can go.
  useEffect(() => {
    clear();
    dropSnapshot();
  }, [clear]);

  return (
    <div className="mx-auto max-w-2xl text-center">
      <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-brand" strokeWidth={1.25} />
      <h1 className="font-display mt-5 text-display text-brand">Thank you. We have your order.</h1>
      {reference ? (
        <p className="mt-3 text-lg">
          Your order number is <strong className="tabular-nums">{orderNumber(reference)}</strong>
        </p>
      ) : null}
      <p className="mx-auto mt-4 max-w-lg text-text-muted">
        We will call or message you to confirm your order{fulfilment === "delivery" ? ", agree the delivery charge and arrange a delivery time" : " and tell you when it is ready to collect"}. Nothing has been charged.
      </p>

      <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
        {fulfilment ? (
          <div className="border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">How</p>
            <p className="mt-1 font-medium">{FULFILMENT_LABEL[fulfilment]}</p>
          </div>
        ) : null}
        {payment ? (
          <div className="border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">You plan to pay</p>
            <p className="mt-1 font-medium">{PAYMENT_LABEL[payment]}</p>
          </div>
        ) : null}
      </div>

      {payment === "bank_transfer" ? (
        <div className="mt-3 border border-border bg-linen p-4 text-left text-sm">
          {bankDetails ? (
            <>
              <p className="font-medium">Our bank details</p>
              <p className="mt-1 whitespace-pre-line">{bankDetails}</p>
              <p className="mt-2 text-text-muted">Please wait until we have confirmed your order before you transfer, and quote {reference ?? "your order number"}.</p>
            </>
          ) : (
            <p>We will send you our bank details when we confirm your order.</p>
          )}
        </div>
      ) : null}

      {snap && snap.items.length > 0 ? (
        <div className="mt-8 border border-border bg-surface p-5 text-left">
          <h2 className="font-display text-[clamp(1.075rem,calc(1.075rem_+_(100vw_-_375px)_*_0.00712),1.25rem)] leading-tight text-brand">Order summary</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {snap.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-2.5">
                <span>
                  {i.quantity} × {i.productName}
                  {i.variantLabel ? <span className="text-text-muted"> · {i.variantLabel}</span> : null}
                </span>
                <span className="shrink-0">{formatMoney(dec(i.price).times(i.quantity), snap.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-border pt-3 font-semibold">
            <span>Total (excl. delivery)</span>
            <span className="tabular-nums">{formatMoney(snap.subtotal, snap.currency)}</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">Any delivery charge is confirmed with you and added when we confirm the order.</p>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {reference ? (
          <ButtonLink href={`/track?ref=${encodeURIComponent(reference)}`} size="cta">
            Track this order
          </ButtonLink>
        ) : null}
        <ButtonLink href="/products" size="cta" variant="secondary">
          Keep browsing
        </ButtonLink>
        {phone ? (
          <ButtonLink href={`tel:${phone.replace(/\s+/g, "")}`} size="cta" variant="secondary">
            Call us: {phone}
          </ButtonLink>
        ) : (
          <ButtonLink href="/contact" size="cta" variant="secondary">
            Contact us
          </ButtonLink>
        )}
      </div>
      {reference ? <p className="mt-6 text-sm text-text-muted">You can check on it at any time: use your order number on the Track your order page.</p> : null}
      <p className="mt-3 text-sm text-text-muted">
        Changed your mind or need to correct something? <Link href="/contact" className="underline">Contact us</Link> and quote your order number.
      </p>
    </div>
  );
}
