import { cn } from "@/lib/cn";

/** Slowly scrolling line of words (real category names). The second copy is hidden from assistive technology. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="marquee-track" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <li key={`${t}-${i}`} className="flex shrink-0 items-center gap-6 whitespace-nowrap">
          <span className="font-display text-[1.125rem] md:text-[1.25rem]">{t}</span>
          <span aria-hidden="true" className="inline-block size-1.5 rotate-45 bg-brass" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("marquee", className)}>
      {row(false)}
      {row(true)}
    </div>
  );
}
