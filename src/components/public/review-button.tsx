"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

/** The pop-up and its form are fetched only when someone opens it, so they are not part of every page's scripts. */
const ReviewDialog = dynamic(() => import("./review-dialog").then((m) => m.ReviewDialog), { ssr: false });
/** Starts fetching the pop-up as soon as a hand is near the button, so it is ready by the time it is pressed. */
const preload = () => void import("./review-dialog");

export function ReviewButton({
  reviewUrl,
  businessName,
  variant = "button",
  className,
  children = "Review us",
}: {
  /** Google's own review box. Without it the review is still saved on the website; only the "Post on Google" step is left out. */
  reviewUrl: string | null;
  businessName: string;
  variant?: "button" | "link";
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Mounted on the first press and kept, so a form that was started is not lost when the pop-up is closed.
  const [used, setUsed] = useState(false);
  const show = () => {
    setUsed(true);
    setOpen(true);
  };
  const hands = { onPointerEnter: preload, onFocus: preload, onTouchStart: preload };

  return (
    <>
      {variant === "button" ? (
        <button type="button" onClick={show} {...hands} className={buttonClasses("primary", "cta", className)} aria-haspopup="dialog">
          {children}
        </button>
      ) : (
        <button type="button" onClick={show} {...hands} className={className ?? "underline"} aria-haspopup="dialog">
          {children}
        </button>
      )}
      {used ? <ReviewDialog open={open} onClose={() => setOpen(false)} reviewUrl={reviewUrl} businessName={businessName} /> : null}
    </>
  );
}
