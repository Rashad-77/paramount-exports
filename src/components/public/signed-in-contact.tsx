"use client";

import { useEffect, useState } from "react";

export interface AccountContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Their default delivery address (five lines), when they have saved one. */
  address?: string | null;
}

let cached: Promise<AccountContact | null> | null = null;

/** The signed-in customer's own details, fetched once per page load. `null` for a visitor; `undefined` while it is still loading. */
export function useAccountContact(): AccountContact | null | undefined {
  const [me, setMe] = useState<AccountContact | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    cached ??= fetch("/api/account/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ customer: (AccountContact & { address?: string | null }) | null }>)
      .then(({ customer }) => (customer ? { name: customer.name || null, email: customer.email || null, phone: customer.phone || null, address: customer.address || null } : null))
      .catch(() => null);
    void cached.then((c) => alive && setMe(c));
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

/**
 * Stands in for the name, phone and email boxes when the customer is signed in and we already have those details: the values travel in
 * hidden fields (the server uses the account's own details anyway) and a single line says who the form is from. A box we do not have
 * a value for, such as a phone number never saved, is still asked for.
 */
export function SignedInLine({ me, name, phone, email }: { me: AccountContact | null | undefined; name: boolean; phone: boolean; email: boolean }) {
  if (!me || !(name || phone || email)) return null;
  const shown = [name ? me.name : null, email ? me.email : null, phone ? me.phone : null].filter(Boolean).join(" · ");
  return (
    <>
      {name ? <input type="hidden" name="name" value={me.name ?? ""} /> : null}
      {phone ? <input type="hidden" name="phone" value={me.phone ?? ""} /> : null}
      {email ? <input type="hidden" name="email" value={me.email ?? ""} /> : null}
      <p className="border border-border bg-linen px-4 py-3 text-sm">
        Sending as <span className="font-medium">{shown}</span>, from your account.
      </p>
    </>
  );
}
