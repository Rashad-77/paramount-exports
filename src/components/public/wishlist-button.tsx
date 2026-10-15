"use client";

import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "wishlist:v1";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function toggle(id: string) {
  let ids: string[] = [];
  try {
    ids = JSON.parse(read()) as string[];
  } catch {
    ids = [];
  }
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private window): the heart simply does not stick.
  }
  listeners.forEach((l) => l());
}

/** Heart toggle for saving a piece. The saved list lives in this browser only. */
export function WishlistButton({ productId, name, size = "md" }: { productId: string; name: string; size?: "md" | "lg" }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => read().includes(`"${productId}"`),
    () => false,
  );
  return (
    <button type="button" className={"wish" + (size === "lg" ? " wish-lg" : "")} aria-pressed={saved} aria-label={`Save ${name} to wishlist`} onClick={() => toggle(productId)}>
      <Heart aria-hidden="true" strokeWidth={1.6} />
    </button>
  );
}
