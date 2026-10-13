"use client";

import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { SiteImage } from "@/components/public/site-image";
import { ButtonLink } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { dec, formatMoney } from "@/lib/money";
import { MAX_QTY } from "@/lib/order-constants";

/** The order basket: change quantities, remove things, see the total, go to checkout. */
export function CartView({ currency }: { currency: string }) {
  const { items, subtotal, setQuantity, remove } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShoppingBag aria-hidden="true" className="mx-auto size-10 text-brand" strokeWidth={1.25} />
        <h2 className="font-display mt-5 text-[1.75rem] leading-tight text-brand">Your order is empty</h2>
        <p className="mt-2 text-text-muted">Browse the collection and add the pieces you like. You pay nothing online.</p>
        <ButtonLink href="/products" size="cta" className="mt-6">
          Browse the collection
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <ul className="divide-y divide-border border-y border-border" aria-label="Items in your order">
        {items.map((i) => (
          <li key={i.variantId} className="flex gap-4 py-5">
            <Link href={`/products/${i.productSlug}`} className="relative block aspect-[4/5] w-24 shrink-0 overflow-hidden bg-[#e4e4e2] sm:w-28" aria-hidden="true" tabIndex={-1}>
              {i.image ? <SiteImage src={i.image} alt="" fill sizes="112px" className="object-cover" /> : <ImagePlaceholder label={i.productName} className="size-full" compact />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/products/${i.productSlug}`} className="font-semibold text-text hover:text-brand">
                    {i.productName}
                  </Link>
                  <p className="text-sm text-text-muted">{[i.variantLabel, i.sku].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" onClick={() => remove(i.variantId)} aria-label={`Remove ${i.productName}`} className="grid size-9 shrink-0 place-items-center text-text-muted hover:text-text">
                  <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                <div className="inline-flex items-center border border-border-strong" role="group" aria-label={`Quantity of ${i.productName}`}>
                  <button type="button" onClick={() => setQuantity(i.variantId, i.quantity - 1)} disabled={i.quantity <= 1} aria-label="One fewer" className="grid size-10 place-items-center hover:bg-linen disabled:opacity-40">
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <span className="min-w-9 text-center text-sm font-medium tabular-nums" aria-live="polite">
                    {i.quantity}
                  </span>
                  <button type="button" onClick={() => setQuantity(i.variantId, i.quantity + 1)} disabled={i.quantity >= MAX_QTY} aria-label="One more" className="grid size-10 place-items-center hover:bg-linen disabled:opacity-40">
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <p className="font-semibold">{formatMoney(dec(i.price).times(i.quantity), currency)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside aria-labelledby="summary-title" className="border border-border bg-surface p-6 lg:sticky lg:top-28">
        <h2 id="summary-title" className="font-display text-[1.5rem] leading-tight text-brand">
          Your order
        </h2>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Items</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Delivery</dt>
            <dd>Agreed with you</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
            <dt>Total so far</dt>
            <dd>{formatMoney(subtotal, currency)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-text-muted">You pay nothing online. We call to confirm your order and the delivery charge, and you pay on delivery, by bank transfer or at the showroom.</p>
        <ButtonLink href="/checkout" size="cta" className="mt-6 w-full justify-center">
          Continue to checkout
        </ButtonLink>
        <p className="mt-4 text-center text-sm">
          <Link href="/products" className="underline">
            Keep browsing
          </Link>
        </p>
      </aside>
    </div>
  );
}
