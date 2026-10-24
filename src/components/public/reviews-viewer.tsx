"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

export interface ViewerReview {
  id: string;
  quote: string;
  name: string | null;
  city: string | null;
  stars?: number;
  photos: string[];
  avatar: string | null;
  /** The day it was posted, dd/mm/yyyy (Google reviews). */
  date?: string | null;
  /** Stand-in photo tiles on a sample review. */
  samplePhotos: number;
}

const Ctx = createContext<{ show: (id?: string) => void; preload: () => void } | null>(null);

/** The long list of every review is fetched only when someone opens it, so it is not part of the page until it is wanted. */
const ReviewsDialog = dynamic(() => import("./reviews-dialog").then((m) => m.ReviewsDialog), { ssr: false });
const preloadDialog = () => void import("./reviews-dialog");

/** Opens the all-reviews pop-up, optionally scrolled to one review. A no-op outside a <ReviewsViewer>. */
export const useReviewsViewer = () => useContext(Ctx) ?? { show: () => undefined, preload: () => undefined };

/**
 * Holds the pop-up that lists every review in full. It drops in from the top of the screen. Cards on the page open it with "See more"
 * (scrolled to their own review) and the "View all" button opens it at the top.
 */
export function ReviewsViewer({ reviews, children }: { reviews: ViewerReview[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Mounted on the first opening and kept.
  const [used, setUsed] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const api = useMemo(
    () => ({
      show: (id?: string) => {
        setFocusId(id ?? null);
        setUsed(true);
        setOpen(true);
      },
      preload: preloadDialog,
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {used ? (
        <ReviewsDialog
          reviews={reviews}
          open={open}
          focusId={focusId}
          onClose={() => {
            setOpen(false);
            setFocusId(null);
          }}
        />
      ) : null}
    </Ctx.Provider>
  );
}

/** Covers the whole review card (put it first inside a `relative` card): a click anywhere on the card opens the pop-up at that review. Anything that must stay clickable on its own sits above it (`relative z-10`). */
export function ReviewCardButton({ id, name }: { id: string; name: string | null }) {
  const { show, preload } = useReviewsViewer();
  return (
    <button
      type="button"
      onClick={() => show(id)}
      onPointerEnter={preload}
      onFocus={preload}
      onTouchStart={preload}
      aria-haspopup="dialog"
      aria-label={`Read the full review by ${name ?? "a customer"}`}
      className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    />
  );
}

export function ViewAllButton({ className }: { className?: string }) {
  const { show, preload } = useReviewsViewer();
  return (
    <button type="button" onClick={() => show()} onPointerEnter={preload} onFocus={preload} onTouchStart={preload} aria-haspopup="dialog" className={buttonClasses("secondary", "cta", className)}>
      View all
    </button>
  );
}
