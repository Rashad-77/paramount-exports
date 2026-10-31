"use client";

import { Check, FileText, Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPEN_QUOTE_EVENT } from "@/lib/page-events";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { MAX_QTY } from "@/lib/order-constants";
import { stockState } from "@/lib/stock";

export interface PanelOption {
  id: string;
  label: string;
  sku: string;
  /** Null when the business does not show a price: the piece can then only be asked about, never bought. */
  price: string | null;
  /** The regular price, when the piece is on sale (the price above is then the price after the discount). */
  compare?: string | null;
  /** How many are in stock; null when the business does not count this piece. */
  stock?: number | null;
}

/**
 * The buying part of a product page: the price (struck through and reduced when the piece is on sale), the stock, the quantity, and
 * "Add to cart" and "Buy now" (straight to checkout). A piece with no public price, or one made to order, points to the general forms
 * instead. Nothing is charged: payment happens offline.
 */
export function PurchasePanel({
  productName,
  productSlug,
  image,
  option,
  currency,
  madeToOrder = false,
}: {
  productName: string;
  productSlug: string;
  image: string | null;
  option: PanelOption | null;
  currency: string;
  madeToOrder?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { add, setQuantity: setLineQuantity } = useCart();
  const router = useRouter();

  const stock = stockState(madeToOrder, option?.stock);
  const soldOut = stock.state === "out";
  // A counted piece cannot be ordered past what is on the shelf; made to order pieces are asked about, not added to the cart.
  const maxQty = stock.state === "in" || stock.state === "low" ? Math.min(MAX_QTY, stock.left) : MAX_QTY;
  const canBuy = Boolean(option?.price) && !madeToOrder && !soldOut;

  const bump = (n: number) => {
    setAdded(false);
    setQuantity((q) => Math.max(1, Math.min(maxQty, q + n)));
  };
  const addToCart = () => {
    if (!option?.price) return;
    add({ variantId: option.id, productSlug, productName, variantLabel: null, sku: option.sku, price: option.price, image }, quantity);
  };

  return (
    <section aria-labelledby="buy-title" className="pp">
      <h2 id="buy-title" className="sr-only">
        Price and buying
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

      {/* Sold out has no line of its own here: the disabled "Sold out" button below already says it. */}
      {/* "Available" and "Made to order" are already in the green tag under the name; this line is only for the warning that few are left. */}
      {stock.state === "low" ? (
        <p className="pp-stock" data-state={stock.state} role="status">
          <span aria-hidden="true" className="pp-dot" />
          Only {stock.left} left, order soon
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
                // Buy now is this piece, in the amount chosen: if it is already in the basket (from Add to cart) its amount is set, not added to.
                if (option?.price) {
                  addToCart();
                  setLineQuantity(option.id, quantity);
                }
                router.push("/checkout");
              }}
            >
              Buy now
            </Button>
          </>
        ) : null}
        {soldOut ? (
          <Button type="button" size="cta" variant="secondary" disabled>
            Not available
          </Button>
        ) : null}
        {/* No price (timber and other pieces whose price depends on the size): the button opens the quotation form further down the page. */}
        {!option?.price ? (
          <Button type="button" size="cta" onClick={() => window.dispatchEvent(new Event(OPEN_QUOTE_EVENT))}>
            <FileText aria-hidden="true" className="size-4" />
            Request quotation
          </Button>
        ) : null}
      </div>

      {/* The button itself says "Added to cart"; this is only for screen readers. */}
      <p className="sr-only" role="status">
        {added ? "Added to your cart." : ""}
      </p>
      {madeToOrder ? (
        <p className="pp-note">
          Made to order. Tell us what you need on the <Link href="/custom#quotation" className="underline">custom furniture form</Link> and we will send a quotation.
        </p>
      ) : !option?.price ? (
        <p className="pp-note">
          The price depends on the size and the amount, so we send a quotation. We reply within one working day.
        </p>
      ) : null}
    </section>
  );
}
