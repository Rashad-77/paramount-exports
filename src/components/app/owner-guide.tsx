"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { searchGuide } from "@/lib/guide-search";
import { GUIDE, GUIDE_SECTIONS, type GuideItem } from "@/lib/owner-guide";
import { GUIDE_SI } from "@/lib/owner-guide-si";
import { useLang } from "./dash-language";

/** One question. Closed it is a single bar; opened it shows the short answer, the steps, the tips and a link to the screen. */
function Entry({ item, open = false, best = false }: { item: GuideItem; open?: boolean; best?: boolean }) {
  return (
    <details open={open || undefined} className="group border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-left marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          {best ? <span className="mb-0.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-timber">Best match</span> : null}
          <span className="block text-sm font-semibold text-walnut sm:text-base">{item.question}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180" strokeWidth={1.75} />
      </summary>
      <div className="space-y-4 border-t border-border px-4 pb-5 pt-4 text-sm leading-relaxed">
        <p className="font-medium text-text">{item.answer}</p>
        {item.steps?.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-text marker:font-semibold marker:text-walnut">
            {item.steps.map((s, i) => (
              <li key={i} className="pl-1">
                {s}
              </li>
            ))}
          </ol>
        ) : null}
        {item.tips?.length ? (
          <div className="border-l-2 border-timber bg-linen/60 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Good to know</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-text">
              {item.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {item.link ? (
          <ButtonLink href={item.link.href} variant="secondary">
            Open {item.link.label}
          </ButtonLink>
        ) : null}
      </div>
    </details>
  );
}

/**
 * The owner's guide: a question box at the top, then the whole guide as questions that open to show the detailed steps. Type a question and press
 * Enter: the answers that fit it best are shown, already open, above the full list.
 */
export function OwnerGuide() {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  /** The question that was sent with Enter (null: none yet). */
  const [asked, setAsked] = useState<string | null>(null);
  const { lang } = useLang();
  const matches = useMemo(() => (asked === null ? [] : searchGuide(asked, GUIDE, 4, GUIDE_SI)), [asked]);
  /** An entry as shown in the chosen language (the buttons and headings around it are translated by the page itself). */
  const view = (item: GuideItem): GuideItem => (lang === "si" && GUIDE_SI[item.id] ? { ...item, ...GUIDE_SI[item.id] } : item);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    setAsked(q === "" ? null : q);
  };
  const clear = () => {
    setText("");
    setAsked(null);
    input.current?.focus();
  };

  return (
    <div className="space-y-8">
      <form onSubmit={submit} role="search" className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-walnut">
          Ask a question
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.75} />
            <input
              ref={input}
              id={inputId}
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="For example: how do I add a photo to a product?"
              autoComplete="off"
              maxLength={200}
              className="h-11 w-full border border-border-strong bg-surface pl-10 pr-4 text-base text-text placeholder:text-text-muted focus:border-walnut focus:outline-none focus:ring-2 focus:ring-walnut/20"
            />
          </div>
          <Button type="submit" size="lg">
            Find the answer
          </Button>
        </div>
        <p className="text-xs text-text-muted">Type your question and press Enter. The best answers open below. The whole guide is listed under it.</p>
      </form>

      {asked !== null ? (
        <section aria-labelledby="results-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="results-title" role="status" className="text-sm font-semibold text-walnut">
              {matches.length > 0 ? `${matches.length === 1 ? "The answer" : "The best answers"} for “${asked}”` : `No answer found for “${asked}”`}
            </h2>
            <Button type="button" variant="ghost" onClick={clear}>
              <X aria-hidden="true" className="size-4" />
              Clear
            </Button>
          </div>
          {matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((m, i) => (
                <Entry key={asked + ":" + m.item.id + ":" + lang} item={view(m.item)} open best={i === 0} />
              ))}
            </div>
          ) : (
            <p className="border border-dashed border-border-strong bg-surface px-4 py-4 text-sm text-text-muted">
              Try fewer words, or other words for the same thing (for example photo, price, order, review or settings). Every question in the guide is listed below.
            </p>
          )}
        </section>
      ) : null}

      <div className="space-y-8">
        {GUIDE_SECTIONS.map((section) => {
          const items = GUIDE.filter((g) => g.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section} aria-labelledby={`guide-${section}`} className="space-y-2">
              <h2 id={`guide-${section}`} className="text-base font-semibold text-walnut">
                {section}
              </h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <Entry key={item.id + ":" + lang} item={view(item)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
