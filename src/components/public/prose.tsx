import Image from "next/image";
import type { ReactNode } from "react";
import { BackBar } from "@/components/public/back-link";
import { ButtonLink } from "@/components/ui/button";

/**
 * Renders plain text safely (no HTML is ever interpreted): blank-line separated paragraphs,
 * "## " headings and "- " bullet lists. Used for editable pages (About, Privacy, Terms).
 */
export function Prose({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: ReactNode[] = [];
  blocks.forEach((block, i) => {
    if (block.startsWith("## ")) {
      out.push(
        <h2 key={i} className="font-display mt-8 text-[clamp(1.15rem,calc(1.15rem_+_(100vw_-_375px)_*_0.01425),1.5rem)] leading-tight text-walnut first:mt-0">
          {block.slice(3)}
        </h2>,
      );
    } else if (block.split("\n").every((l) => l.startsWith("- "))) {
      out.push(
        <ul key={i} className="list-disc space-y-1 pl-6">
          {block.split("\n").map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>,
      );
    } else {
      out.push(
        <p key={i} className="whitespace-pre-line">
          {block}
        </p>,
      );
    }
  });
  return <div className="max-w-[var(--reading-width)] space-y-4 text-text">{out}</div>;
}

export function PageIntro({ title, lead, eyebrow, action, brand, back }: { title: string; lead?: string; eyebrow?: string | null; plain?: boolean; action?: { href: string; label: string }; brand?: string; back?: { href: string; to: string } }) {
  const [brandFirst = "", ...brandRest] = (brand ?? "").trim().split(/\s+/);
  return (
    // A dark band that runs up behind the floating header.
    <header className="plain-band on-wood relative">
      {back ? <BackBar href={back.href} to={back.to} /> : null}
      <div className="container-page flex items-end justify-between gap-10 pt-[clamp(8rem,12vw,10rem)] pb-[clamp(3rem,6vw,5rem)]">
        <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className={"font-display max-w-3xl text-display text-white" + (eyebrow ? " mt-4" : "")}>{title}</h1>
        {lead ? <p className="mt-5 max-w-xl text-base leading-relaxed on-wood-muted">{lead}</p> : null}
        {action ? (
          <div className="mt-8">
            <ButtonLink href={action.href} size="cta" variant="light">
              {action.label}
            </ButtonLink>
          </div>
        ) : null}
        </div>
        {brand ? (
          // The brand as in the header: the logo mark, then the name in two lines, left-aligned beside it, centred against the heading.
          <div aria-hidden="true" className="hidden shrink-0 items-center gap-[clamp(0.9rem,0.5rem+0.9vw,1.4rem)] self-center lg:flex">
            <Image src="/logo-mark.png" alt="" width={72} height={72} className="size-[clamp(2.6rem,1.6rem+2.2vw,3.6rem)] shrink-0 brightness-0 invert" />
            <p className="grid gap-[0.55rem] text-left leading-none">
              <span className="block whitespace-nowrap text-[clamp(1.375rem,calc(1.375rem_+_(100vw_-_375px)_*_0.03562),2.25rem)] font-semibold uppercase tracking-[0.26em] text-white">{brandFirst}</span>
              {brandRest.length ? <span className="block whitespace-nowrap text-[clamp(0.6rem,0.5rem+0.25vw,0.78rem)] font-normal uppercase tracking-[0.3em] text-white/75">{brandRest.join(" ")}</span> : null}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
