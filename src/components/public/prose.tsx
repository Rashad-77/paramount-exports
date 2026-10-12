import type { ReactNode } from "react";

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
        <h2 key={i} className="font-display mt-12 text-[1.875rem] leading-tight text-walnut first:mt-0">
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

export function PageIntro({ title, lead, eyebrow }: { title: string; lead?: string; eyebrow?: string }) {
  return (
    <header className="wood-dark-bg relative isolate overflow-hidden text-ivory">
      <div aria-hidden="true" className="hero-glow" />
      <div className="container-page relative py-[clamp(3.5rem,2rem+6vw,7rem)]">
        <p className="eyebrow rise-in !text-linen-dark">{eyebrow ?? "Furniture · Showroom · Workshop"}</p>
        <h1 className="font-display rise-in rise-in-2 mt-6 max-w-4xl text-display text-ivory">{title}</h1>
        {lead ? <p className="rise-in rise-in-3 mt-7 max-w-xl text-lg leading-relaxed text-ivory/80">{lead}</p> : null}
      </div>
    </header>
  );
}
