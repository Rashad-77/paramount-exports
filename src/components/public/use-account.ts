"use client";

import { useEffect, useState } from "react";

export interface AccountMe {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  /** Their profile picture (uploaded, or the one from Google), if any. */
  avatar?: string | null;
  /** Ids of the products they have saved. */
  wishlist: string[];
}

/** One lookup serves every heart and form on the page; it is asked again after a few seconds so a new sign-in is noticed. */
let shared: { at: number; promise: Promise<AccountMe | null> } | null = null;
function lookup(): Promise<AccountMe | null> {
  if (!shared || Date.now() - shared.at > 5000) {
    shared = {
      at: Date.now(),
      promise: fetch("/api/account/me", { cache: "no-store" })
        .then((r) => r.json() as Promise<{ customer: AccountMe | null }>)
        .then((j) => j.customer)
        .catch(() => null),
    };
  }
  return shared.promise;
}

/** Everything on the page that shows who is signed in, told at once when they sign out. */
const listeners = new Set<(c: AccountMe | null) => void>();

/** Call as a customer signs out: the header's account picture, the hearts and the forms go back to the visitor's view straight away, without a refresh. */
export function forgetAccount() {
  shared = { at: Date.now(), promise: Promise.resolve(null) };
  for (const l of listeners) l(null);
}

/** Who is signed in: `undefined` while we are asking, `null` for a visitor, or the customer's own details. */
export function useAccount(enabled: boolean): AccountMe | null | undefined {
  const [me, setMe] = useState<AccountMe | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    lookup().then((c) => alive && setMe(c));
    listeners.add(setMe);
    return () => {
      alive = false;
      listeners.delete(setMe);
    };
  }, [enabled]);
  return enabled ? me : null;
}
