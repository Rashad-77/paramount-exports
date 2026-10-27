"use client";

import { useEffect, useRef, useState } from "react";
import { PREMIUM_MAX_WORDS, countWords } from "@/lib/premium-copy";

/**
 * Under the detailed description: for a piece in the premium range, how many of the allowed words are used. It reads the description and the
 * Premium range tick from the form it sits in, and turns red when there are too many (the form then refuses to save).
 */
export function PremiumWordCount() {
  const root = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<{ premium: boolean; words: number }>({ premium: false, words: 0 });

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const read = () => {
      const text = form.querySelector<HTMLTextAreaElement>('textarea[name="description"]');
      const tick = form.querySelector<HTMLInputElement>('input[name="isPremium"]');
      setState({ premium: Boolean(tick?.checked), words: countWords(text?.value) });
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, []);

  const over = state.words > PREMIUM_MAX_WORDS;
  return (
    <p ref={root} aria-live="polite" className={"text-xs " + (over ? "text-danger" : "text-text-muted")} hidden={!state.premium}>
      Premium range: {state.words} of {PREMIUM_MAX_WORDS} words. {over ? "Shorten it to save: on the premium page the words stop where the photograph ends." : "The words on the premium page stop where the photograph ends."}
    </p>
  );
}
