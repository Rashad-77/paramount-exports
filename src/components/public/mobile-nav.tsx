"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export interface NavLink {
  label: string;
  href: string;
}

/** Disclosure-style mobile menu: button controls a panel; Escape closes it; links close it. */
export function MobileNav({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-[var(--radius-md)] hover:bg-linen"
      >
        {open ? <X aria-hidden="true" className="size-6" strokeWidth={1.5} /> : <Menu aria-hidden="true" className="size-6" strokeWidth={1.5} />}
      </button>
      <nav
        id={panelId}
        aria-label="Mobile"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-ivory px-[var(--gutter)] pb-4 shadow-[var(--shadow-md)]"
      >
        <ul className="divide-y divide-border">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center text-base">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
