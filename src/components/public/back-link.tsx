"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { previousPage } from "@/components/nav-trail";

/**
 * A quiet "Back" link: an arrow and one word. With `history` it leads back to the page the visitor came from in this tab (a list with its
 * search and filters, a customer's page, a product's page), and only when there is no such page does it go to `href`, which always leads
 * somewhere sensible. `to` names the fallback for screen readers. Use tone "dark" on light pages.
 */
export function BackLink({ href, to, history = false, tone = "light", className }: { href: string; to: string; history?: boolean; tone?: "light" | "dark"; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      data-tone={tone}
      className={"back-link" + (className ? " " + className : "")}
      onClick={(e) => {
        if (!history) return;
        const prev = previousPage();
        if (prev) {
          e.preventDefault();
          router.push(prev);
        }
      }}
    >
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      Back
      <span className="sr-only"> to {to}</span>
    </Link>
  );
}

/** The back link as it sits on a dark banner: pinned at the top left, just under the header. */
export function BackBar({ href, to, history = true }: { href: string; to: string; history?: boolean }) {
  return (
    <div className="back-bar container-page">
      <BackLink href={href} to={to} history={history} />
    </div>
  );
}
