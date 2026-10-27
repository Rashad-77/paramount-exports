"use client";

import { useEffect, useRef, useState } from "react";
import { useReviewsViewer } from "@/components/public/reviews-viewer";

/**
 * The words of one review on a card. A long review is cut to four lines (so one long review does not stretch every card in the row);
 * when the cut really hides something, "See more" opens the all-reviews pop-up scrolled to this review.
 */
export function ReviewQuote({ id, quote }: { id: string; quote: string }) {
  const { show } = useReviewsViewer();
  const box = useRef<HTMLQuoteElement>(null);
  const [cut, setCut] = useState(false);

  // Whether the text is cut depends on the card's width, so it is measured, and measured again when the width changes.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [quote]);

  // A review with no words (just the stars) has no text to show.
  if (!quote.trim()) return null;
  return (
    <>
      <blockquote ref={box} className="mt-4 line-clamp-4 text-[clamp(0.7313rem,calc(0.7313rem_+_(100vw_-_375px)_*_0.00331),0.8125rem)] leading-relaxed text-text">
        {quote}
      </blockquote>
      {cut ? (
        <button type="button" onClick={() => show(id)} aria-haspopup="dialog" className="relative z-10 -mb-3 mt-1 inline-flex min-h-11 items-center self-start text-xs font-medium underline">
          See more
        </button>
      ) : null}
    </>
  );
}
