"use client";

import { useEffect, useRef } from "react";
import { splitAddress } from "@/lib/address-lines";

const FIELDS = ["name", "email", "phone", "address"] as const;
/** The delivery address when a form asks for it in parts, like the address form in the account. */
const ADDRESS_PARTS = ["line1", "line2", "line3", "city", "postalCode"] as const;

/** Sets a box's value the way typing would, so the form (and React) notice it. Never overwrites something already typed. */
function fill(form: HTMLFormElement, name: string, value: string | null | undefined) {
  const el = form.elements.namedItem(name);
  if (!value || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.value) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Put inside a form. For a signed-in customer it fills in their saved name, email, phone and address, but only into boxes that are
 * still empty, so it can never overwrite something the person has already typed. Visitors who are not signed in see no change.
 */
export function PrefillFromAccount() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ customer: Partial<Record<(typeof FIELDS)[number], string | null>> | null }>)
      .then(({ customer }) => {
        const form = marker.current?.closest("form");
        if (!alive || !customer || !form) return;
        for (const name of FIELDS) {
          const raw = customer[name];
          // A saved address keeps an empty line for each line left blank; the box should not show them.
          const value = name === "address" && raw ? raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n") : raw;
          fill(form, name, value);
        }
        // The delivery address, when the form has a box for each part: the saved address fills the whole form, ready to change.
        const saved = customer.address;
        if (saved && form.elements.namedItem("line1")) {
          const parts = splitAddress(saved);
          for (const name of ADDRESS_PARTS) fill(form, name, parts[name]);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return <span ref={marker} hidden />;
}
