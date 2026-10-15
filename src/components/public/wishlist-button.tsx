"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleWishlistAction } from "@/app/(public)/account/actions";
import { useAccount } from "./use-account";

/**
 * Save a product to the wishlist. On a product page ("heart") a visitor is taken to sign in, and a signed-in customer saves or
 * un-saves with one press. On the wishlist page ("remove") the same press takes the product off the list.
 */
export function WishlistButton({ productId, slug, enabled = true, initiallySaved = false, variant = "heart" }: { productId: string; slug?: string; enabled?: boolean; initiallySaved?: boolean; variant?: "heart" | "remove" }) {
  const me = useAccount(variant === "heart" ? enabled : false);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const saved = answer ?? (me ? me.wishlist.includes(productId) : initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (variant === "heart" && !enabled) return null;

  if (variant === "heart" && me === null) {
    return (
      <Link href={`/account/sign-in?next=${encodeURIComponent(`/products/${slug ?? ""}`)}`} className="heart-btn">
        <Heart aria-hidden="true" strokeWidth={1.5} />
        Save to wishlist
      </Link>
    );
  }

  const press = () =>
    start(async () => {
      setError(null);
      const r = await toggleWishlistAction(productId);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setAnswer(r.saved);
      if (variant === "remove") router.refresh();
    });

  return (
    <div>
      <button type="button" className="heart-btn" aria-pressed={saved} disabled={pending || (variant === "heart" && me === undefined)} onClick={press}>
        <Heart aria-hidden="true" strokeWidth={1.5} />
        {variant === "remove" ? "Remove from wishlist" : saved ? "Saved to wishlist" : "Save to wishlist"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
