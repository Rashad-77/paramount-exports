"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { toggleWishlistAction } from "@/app/(public)/account/actions";
import { useAccount } from "./use-account";

/**
 * Save a product to the wishlist. On a product page ("heart") a visitor is taken to sign in, and a signed-in customer saves or
 * un-saves with one press. On the wishlist page ("remove") the same press takes the product off the list.
 */
export function WishlistButton({ productId, slug, enabled = true, initiallySaved = false, variant = "heart", size = "card", refreshOnChange = false, confirmRemove = false }: { productId: string; slug?: string; enabled?: boolean; initiallySaved?: boolean; variant?: "heart" | "remove" | "icon"; size?: "card" | "photo"; refreshOnChange?: boolean; confirmRemove?: boolean }) {
  const me = useAccount(variant !== "remove" ? enabled : false);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const saved = answer ?? (me ? me.wishlist.includes(productId) : initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const router = useRouter();

  if (variant !== "remove" && !enabled) return null;
  const round = variant === "icon";
  const roundClass = "wish" + (size === "photo" ? " wish-photo" : "");

  if (round && me === null) {
    return (
      <Link href={`/account/sign-in?next=${encodeURIComponent(`/products/${slug ?? ""}`)}`} className={roundClass} aria-label="Sign in to save this product to your wishlist">
        <Heart aria-hidden="true" strokeWidth={1.4} />
      </Link>
    );
  }

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
      if (variant === "remove" || refreshOnChange) router.refresh();
    });

  if (round) {
    return (
      <>
        <button type="button" className={roundClass} aria-pressed={saved} aria-label={saved ? "Remove from your wishlist" : "Save to your wishlist"} disabled={pending || me === undefined} onClick={() => (confirmRemove && saved ? setAsking(true) : press())}>
          <Heart aria-hidden="true" strokeWidth={1.4} />
        </button>
        {confirmRemove ? (
          <ConfirmDialog
            open={asking}
            onClose={() => setAsking(false)}
            title="Remove from your wishlist?"
            description="This product will be taken off your wishlist. You can save it again from its page."
            confirmLabel="Remove"
            destructive
            pending={pending}
            onConfirm={() => {
              setAsking(false);
              press();
            }}
          />
        ) : null}
      </>
    );
  }

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
