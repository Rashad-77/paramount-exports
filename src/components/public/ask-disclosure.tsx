"use client";

import { MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { OPEN_ENQUIRY_EVENT } from "@/lib/page-events";

/**
 * "Have a question about this piece?": one line and a button. Pressing it opens the form in place, so a product page stays short.
 * The form is already on the page (only hidden), so its anti-spam token is ready by the time it is opened.
 */
export function AskDisclosure({ title, text, openLabel, children, sectionId = "enquire", opensOn = OPEN_ENQUIRY_EVENT }: { title: string; text: string; openLabel: string; children: ReactNode; sectionId?: string; opensOn?: string }) {
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
    window.addEventListener(opensOn, openIt);
    return () => window.removeEventListener(opensOn, openIt);
  }, [opensOn]);

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
    <section id={sectionId} aria-labelledby={`${id}-title`} className="ask">
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
