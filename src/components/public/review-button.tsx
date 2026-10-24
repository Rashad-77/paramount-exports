import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * "Review us on Google": opens Google's own review box for the business in a new tab. Nothing is written on this website, so there is
 * nothing to approve here: the review lives on Google and shows in the feedback row from there. Without a Google review link (not set up in
 * Settings yet) nothing is shown, because there would be nowhere to send the visitor.
 */
export function ReviewButton({
  reviewUrl,
  variant = "button",
  className,
  children = "Review us on Google",
}: {
  /** Google's review box for the business (from the Place ID, or the link typed in Settings). */
  reviewUrl: string | null;
  variant?: "button" | "link";
  className?: string;
  children?: ReactNode;
}) {
  if (!reviewUrl) return null;
  const classes = variant === "button" ? buttonClasses("primary", "cta", className) : (className ?? "underline");
  return (
    <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className={classes}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
