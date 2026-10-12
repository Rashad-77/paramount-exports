import { cn } from "@/lib/cn";

/** Slowly scrolling line of words (real category names). The second copy is hidden from assistive technology. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="marquee-track" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <li key={`${t}-${i}`}>{t}</li>
      ))}
    </ul>
  );
  return (
    <div className="marquee-wrap">
      <div className={cn("marquee", className)}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
