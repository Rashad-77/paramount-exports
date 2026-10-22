"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import styles from "./receipt.module.css";

export interface ToolbarLink {
  href: string;
  label: string;
  active: boolean;
}

/** The bar above the sheet (never printed): back, switch between the receipt and the delivery note, and print. `auto` opens the print dialog on arrival. */
export function ReceiptToolbar({ backHref, backLabel = "Back to the order", links, auto }: { backHref?: string; backLabel?: string; links?: ToolbarLink[]; auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <div className={styles.toolbar}>
      {backHref ? (
        <Link href={backHref} className="inline-flex items-center gap-1.5 underline">
{backLabel}
        </Link>
      ) : (
        <span />
      )}
      {links && links.length > 1 ? (
        <nav aria-label="Document" className="flex gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} replace aria-current={l.active ? "page" : undefined} className={"border px-3 py-1.5 " + (l.active ? "border-walnut-dark bg-surface font-semibold" : "border-border-strong underline")}>
              {l.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <Button onClick={() => window.print()}>
        <Printer aria-hidden="true" className="size-4" /> Print / Save as PDF
      </Button>
    </div>
  );
}
