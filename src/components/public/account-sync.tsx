"use client";

import { useEffect, useRef } from "react";
import { loadSavedCartAction, saveCartAction } from "@/app/(public)/account/actions";
import { useCart } from "@/lib/cart";

/**
 * Mounted once, only while customer accounts are on. For a signed-in customer it brings their saved basket into this browser
 * (merged with whatever is already here) and then keeps the saved copy up to date as the basket changes.
 * Visitors who are not signed in are not affected at all: nothing is sent anywhere.
 */
export function AccountSync() {
  const { items, merge } = useCart();
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await fetch("/api/account/me", { cache: "no-store" }).then((r) => r.json() as Promise<{ customer: unknown }>);
        if (!alive || !me.customer) return;
        const saved = await loadSavedCartAction();
        if (!alive) return;
        merge(saved);
        ready.current = true;
      } catch {
        /* offline or signed out: the basket simply stays in this browser */
      }
    })();
    return () => {
      alive = false;
    };
  }, [merge]);

  useEffect(() => {
    if (!ready.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveCartAction(items).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer.current);
  }, [items]);

  return null;
}
