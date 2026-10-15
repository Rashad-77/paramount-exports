"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { MAX_QTY } from "@/lib/order-constants";

export interface BuyOption {
  id: string;
  label: string;
  sku: string;
  /** Only options with a public price can be ordered. */
  price: string | null;
  /** The price before a sale, when there is one. */
  compare?: string | null;
}

/** Choose an option and a quantity, then add it to the order basket. Nothing is charged: payment happens offline. */
export function AddToCart({ productName, productSlug, image, options, currency }: { productName: string; productSlug: string; image: string | null; options: BuyOption[]; currency: string }) {
  const orderable = options.filter((o) => o.price);
  const [optionId, setOptionId] = useState(orderable[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const option = orderable.find((o) => o.id === optionId);

  if (orderable.length === 0) return null;

  const bump = (n: number) => {
    setAdded(false);
    setQuantity((q) => Math.max(1, Math.min(MAX_QTY, q + n)));
  };

  return (
    <section aria-labelledby="order-title" className="mt-7 border border-border bg-surface p-6">
      <h2 id="order-title" className="font-display text-[1.5rem] leading-tight text-walnut">
        Order this piece
      </h2>
      <p className="mt-1 text-sm text-text-muted">We confirm your order, agree delivery with you, and you pay on delivery, by bank transfer or at the showroom.</p>

      {orderable.length > 1 ? (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Option</legend>
          <div className="flex flex-wrap gap-2">
            {orderable.map((o) => (
              <label key={o.id} className={"cursor-pointer border px-3.5 py-2 text-sm " + (o.id === optionId ? "border-brand bg-brand/5 font-semibold text-brand" : "border-border-strong hover:border-brand")}>
                <input
                  type="radio"
                  name="option"
                  value={o.id}
                  checked={o.id === optionId}
                  onChange={() => {
                    setOptionId(o.id);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                {o.label} · {formatMoney(o.price!, currency)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <p className="mt-5 text-2xl font-semibold text-brand">
        {option?.compare ? <del className="price-was">{formatMoney(option.compare, currency)}</del> : null}
        {option ? option.compare ? <ins className="price-now">{formatMoney(option.price!, currency)}</ins> : formatMoney(option.price!, currency) : null}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="inline-flex items-center border border-border-strong" role="group" aria-label="Quantity">
          <button type="button" onClick={() => bump(-1)} disabled={quantity <= 1} aria-label="One fewer" className="grid size-11 place-items-center hover:bg-linen disabled:opacity-40">
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <span className="min-w-10 text-center font-medium tabular-nums" aria-live="polite">
            {quantity}
          </span>
          <button type="button" onClick={() => bump(1)} disabled={quantity >= MAX_QTY} aria-label="One more" className="grid size-11 place-items-center hover:bg-linen disabled:opacity-40">
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
        <Button
          type="button"
          size="cta"
          disabled={!option}
          onClick={() => {
            if (!option) return;
            add({ variantId: option.id, productSlug, productName, variantLabel: option.label === "Standard" ? null : option.label, sku: option.sku, price: option.price!, image }, quantity);
            setAdded(true);
          }}
        >
          {added ? <Check aria-hidden="true" className="size-4" /> : <ShoppingBag aria-hidden="true" className="size-4" />}
          {added ? "Added to your order" : "Add to order"}
        </Button>
      </div>

      <p className="mt-4 min-h-6 text-sm" role="status">
        {added ? (
          <>
            <Link href="/cart" className="font-semibold text-brand underline">
              View your cart
            </Link>{" "}
            or keep browsing.
          </>
        ) : null}
      </p>
    </section>
  );
}
