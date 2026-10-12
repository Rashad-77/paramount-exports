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
        <h2 key={i} className="font-display mt-8 text-[1.5rem] leading-tight text-walnut first:mt-0">
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
    <header className="wood-band on-wood">
      <div className="container-page py-[clamp(2.5rem,6vw,4.75rem)]">
        <p className="eyebrow rise-in">{eyebrow ?? "Showroom and workshop"}</p>
        <h1 className="font-display rise-in rise-in-2 mt-3 max-w-3xl text-display text-white">{title}</h1>
        {lead ? <p className="rise-in rise-in-3 mt-4 max-w-xl text-base leading-relaxed on-wood-muted">{lead}</p> : null}
      </div>
    </header>
  );
}
