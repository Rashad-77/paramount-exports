"use client";

import { Check, FileText, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { MAX_QTY } from "@/lib/order-constants";
import { quoteHref, type QuoteDetails } from "@/lib/quote-link";

export interface PanelOption {
  id: string;
  label: string;
  sku: string;
  /** Null when the business does not show a price: the option can then only be asked about, never bought. */
  price: string | null;
  /** The price before a sale, when there is one. */
  compare?: string | null;
}

/**
 * The buying part of a product page. Choosing an option updates the code and the price. A piece with a public price can be added to the
 * cart or bought now (straight to checkout); a piece sold by quotation, or without a public price, offers "Request a quote", which
 * opens the quotation form with the piece already filled in. Nothing is charged: payment happens offline.
 */
export function PurchasePanel({
  productName,
  productSlug,
  image,
  options,
  currency,
  mode,
  quote,
  leadTime,
}: {
  productName: string;
  productSlug: string;
  image: string | null;
  options: PanelOption[];
  currency: string;
  mode: "direct" | "quote" | "both";
  quote: QuoteDetails;
  leadTime: string | null;
}) {
  const orderable = options.filter((o) => o.price);
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const router = useRouter();
  const option = options.find((o) => o.id === optionId) ?? options[0];

  const canBuy = mode !== "quote" && Boolean(option?.price);
  const canQuote = mode !== "direct" || !canBuy;

  const bump = (n: number) => {
    setAdded(false);
    setQuantity((q) => Math.max(1, Math.min(MAX_QTY, q + n)));
  };
  const addToCart = () => {
    if (!option?.price) return;
    add({ variantId: option.id, productSlug, productName, variantLabel: option.label === "Standard" ? null : option.label, sku: option.sku, price: option.price, image }, quantity);
  };

  return (
    <section aria-labelledby="buy-title" className="pp">
      <h2 id="buy-title" className="sr-only">
        Price and buying options
      </h2>

      <div className="pp-price">
        {option?.price ? (
          <p>
            {option.compare ? <del className="price-was">{formatMoney(option.compare, currency)}</del> : null}
            {option.compare ? <ins className="price-now">{formatMoney(option.price, currency)}</ins> : <span>{formatMoney(option.price, currency)}</span>}
          </p>
        ) : (
          <p>
            <span>Price on request</span>
          </p>
        )}
        <p className="pp-code">
          Product code <span>{option?.sku}</span>
        </p>
      </div>

      {options.length > 1 ? (
        <fieldset className="pp-options">
          <legend>Option</legend>
          <div>
            {options.map((o) => (
              <label key={o.id} data-on={o.id === optionId ? "" : undefined}>
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
                {o.label}
                {o.price ? <span> · {formatMoney(o.price, currency)}</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {leadTime ? (
        <p className="pp-lead">
          <span>Lead time</span> {leadTime}
        </p>
      ) : null}

      {canBuy ? (
        <div className="pp-qty">
          <span id="qty-label">Quantity</span>
          <div role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => bump(-1)} disabled={quantity <= 1} aria-label="One fewer">
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" onClick={() => bump(1)} disabled={quantity >= MAX_QTY} aria-label="One more">
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="pp-actions">
        {canBuy ? (
          <>
            <Button
              type="button"
              size="cta"
              onClick={() => {
                addToCart();
                setAdded(true);
              }}
            >
              {added ? <Check aria-hidden="true" className="size-4" /> : <ShoppingBag aria-hidden="true" className="size-4" />}
              {added ? "Added to cart" : "Add to cart"}
            </Button>
            <Button
              type="button"
              size="cta"
              variant="secondary"
              className="pp-flat"
              onClick={() => {
                addToCart();
                router.push("/checkout");
              }}
            >
              Buy now
            </Button>
          </>
        ) : null}
        {canQuote ? (
          <ButtonLink href={quoteHref(quote, option?.label)} size="cta" variant={canBuy ? "secondary" : "primary"}>
            <FileText aria-hidden="true" className="size-4" />
            Request a quote
          </ButtonLink>
        ) : null}
      </div>

      <p className="pp-status" role="status">
        {added ? (
          <>
            <Link href="/cart">View your cart</Link> or keep browsing.
          </>
        ) : null}
      </p>
      {orderable.length === 0 && mode === "direct" ? <p className="pp-note">Ask us for the price. We reply within one working day.</p> : null}
    </section>
  );
}
