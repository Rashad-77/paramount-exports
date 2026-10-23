"use client";

import { Check, FileText, Minus, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { MAX_QTY } from "@/lib/order-constants";
import { quoteHref, type QuoteDetails } from "@/lib/quote-link";
import { stockState } from "@/lib/stock";

export interface PanelOption {
  id: string;
  label: string;
  sku: string;
  /** Null when the business does not show a price: the option can then only be asked about, never bought. */
  price: string | null;
  /** The price before a sale, when there is one. */
  compare?: string | null;
  /** How many are in stock; null when the business does not count this option. */
  stock?: number | null;
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
  madeToOrder = false,
  quote,
}: {
  productName: string;
  productSlug: string;
  image: string | null;
  options: PanelOption[];
  currency: string;
  mode: "direct" | "quote" | "both";
  madeToOrder?: boolean;
  quote: QuoteDetails;
}) {
  const orderable = options.filter((o) => o.price);
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const router = useRouter();
  const option = options.find((o) => o.id === optionId) ?? options[0];

  const stock = stockState(madeToOrder, option?.stock);
  const soldOut = stock.state === "out";
  // A counted option cannot be ordered past what is on the shelf; made to order pieces are asked about, not added to the cart.
  const maxQty = stock.state === "in" || stock.state === "low" ? Math.min(MAX_QTY, stock.left) : MAX_QTY;
  const canBuy = mode !== "quote" && Boolean(option?.price) && !madeToOrder && !soldOut;
  const canQuote = madeToOrder || (!soldOut && (mode !== "direct" || !canBuy));

  const bump = (n: number) => {
    setAdded(false);
    setQuantity((q) => Math.max(1, Math.min(maxQty, q + n)));
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
      </div>

      {stock.state !== "untracked" ? (
        <p className="pp-stock" data-state={stock.state} role="status">
          <span aria-hidden="true" className="pp-dot" />
          {stock.state === "in" ? `In stock · ${stock.left} available` : null}
          {stock.state === "low" ? `Only ${stock.left} left, order soon` : null}
          {stock.state === "out" ? "Sold out" : null}
          {stock.state === "made_to_order" ? "Made to order" : null}
        </p>
      ) : null}

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
                    setQuantity(1);
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


      {canBuy ? (
        <div className="pp-qty">
          <span id="qty-label">Quantity</span>
          <div role="group" aria-labelledby="qty-label">
            <button type="button" onClick={() => bump(-1)} disabled={quantity <= 1} aria-label="One fewer">
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <output aria-live="polite">{quantity}</output>
            <button type="button" onClick={() => bump(1)} disabled={quantity >= maxQty} aria-label="One more">
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
        {soldOut ? (
          <Button type="button" size="cta" variant="secondary" disabled>
            Sold out
          </Button>
        ) : null}
        {canQuote ? (
          <ButtonLink href={quoteHref(quote, option?.label)} size="cta" variant={canBuy ? "secondary" : "primary"}>
            <FileText aria-hidden="true" className="size-4" />
            {madeToOrder ? "Request quotation" : "Request a quote"}
          </ButtonLink>
        ) : null}
      </div>

      {/* The button itself says "Added to cart"; this is only for screen readers. */}
      <p className="sr-only" role="status">
        {added ? "Added to your cart." : ""}
      </p>
      {orderable.length === 0 && mode === "direct" ? <p className="pp-note">Ask us for the price. We reply within one working day.</p> : null}
    </section>
  );
}
