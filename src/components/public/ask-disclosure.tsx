"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Sent by the "Request quotation" button beside the price: opens this form and brings it into view. */
export const OPEN_ENQUIRY_EVENT = "open-enquiry";

/**
 * "Have a question about this piece?": one line and a button. Pressing it opens the form in place, so a product page stays short.
 * The form is already on the page (only hidden), so its anti-spam token is ready by the time it is opened.
 */
export function AskDisclosure({ title, text, openLabel, children }: { title: string; text: string; openLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const region = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openIt = () => {
      setOpen(true);
      requestAnimationFrame(() => {
        region.current?.querySelector<HTMLInputElement>("input:not([type=hidden]):not([tabindex='-1'])")?.focus({ preventScroll: true });
        region.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    };
    window.addEventListener(OPEN_ENQUIRY_EVENT, openIt);
    return () => window.removeEventListener(OPEN_ENQUIRY_EVENT, openIt);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Once the form is showing, put the cursor in its first box so the visitor can simply start typing.
      requestAnimationFrame(() => {
        region.current?.querySelector<HTMLInputElement>("input:not([type=hidden]):not([tabindex='-1'])")?.focus({ preventScroll: true });
        region.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  };

  return (
    <section id="enquire" aria-labelledby={`${id}-title`} className="ask">
      <div className="ask-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{text}</p>
        </div>
        <button type="button" className="ask-btn" aria-expanded={open} aria-controls={`${id}-form`} onClick={toggle}>
          {open ? <X aria-hidden="true" strokeWidth={1.5} /> : <MessageCircle aria-hidden="true" strokeWidth={1.5} />}
          {open ? "Close" : openLabel}
        </button>
      </div>
      <div ref={region} id={`${id}-form`} hidden={!open} className="ask-body">
        {children}
      </div>
    </section>
  );
}
