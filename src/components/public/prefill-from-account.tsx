"use client";

import { useEffect, useRef } from "react";

const FIELDS = ["name", "email", "phone", "address"] as const;

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
          const el = form.elements.namedItem(name);
          if (!value || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.value) continue;
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return <span ref={marker} hidden />;
}
