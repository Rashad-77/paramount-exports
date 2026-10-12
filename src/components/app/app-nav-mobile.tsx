"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

/** Slide-down menu for narrow screens. Closes on Escape and on any navigation click inside it. */
export function AppNavMobile({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center text-ivory hover:bg-ivory/10"
      >
        {open ? <X aria-hidden="true" className="size-6" strokeWidth={1.5} /> : <Menu aria-hidden="true" className="size-6" strokeWidth={1.5} />}
      </button>
      <div
        id={id}
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        className="wood-dark-bg absolute inset-x-0 top-full max-h-[calc(100dvh-var(--header-height))] overflow-y-auto border-t border-ivory/15 p-4 text-ivory shadow-[var(--shadow-lg)]"
      >
        {children}
      </div>
    </>
  );
}
