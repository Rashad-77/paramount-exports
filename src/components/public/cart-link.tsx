"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/lib/cart";

/** Header link to the order basket, with a count once something has been added. */
export function CartLink({ onClick }: { onClick?: () => void }) {
  const { count } = useCart();
  return (
    <Link href="/cart" className="cart" onClick={onClick} aria-label={count ? `Your cart, ${count} ${count === 1 ? "item" : "items"}` : "Your cart, empty"}>
      <ShoppingBag aria-hidden="true" className="size-4" strokeWidth={1.5} />
      {count > 0 ? <span className="cart-count">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
