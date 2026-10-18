"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A quiet "Back" link: an arrow and one word. It always leads somewhere sensible (`href`), and with `history` it instead steps back
 * to the page the visitor came from on this site (so a search or a filter on the collection is still there), falling back to `href`
 * when they arrived from elsewhere. `to` names the destination for screen readers. Use tone "dark" on light pages.
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
        try {
          if (document.referrer && new URL(document.referrer).origin === window.location.origin && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        } catch {
          // Fall through to the link itself.
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
export function BackBar({ href, to, history }: { href: string; to: string; history?: boolean }) {
  return (
    <div className="back-bar container-page">
      <BackLink href={href} to={to} history={history} />
    </div>
  );
}
