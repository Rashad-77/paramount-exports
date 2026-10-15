"use client";

import { useEffect, useState } from "react";

export interface AccountMe {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  /** Ids of the products they have saved. */
  wishlist: string[];
}

/** Who is signed in: `undefined` while we are asking, `null` for a visitor, or the customer's own details. */
export function useAccount(enabled: boolean): AccountMe | null | undefined {
  const [me, setMe] = useState<AccountMe | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/account/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ customer: AccountMe | null }>)
      .then((j) => alive && setMe(j.customer))
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? me : null;
}
