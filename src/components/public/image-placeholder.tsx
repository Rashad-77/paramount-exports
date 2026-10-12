import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Neutral frame standing in for client photography. It is honest about being a placeholder (the caption says so) and is
 * replaced by the real <Image> as soon as a photograph is uploaded.
 */
export function ImagePlaceholder({ label, className, compact = false }: { label: string; className?: string; compact?: boolean }) {
  return (
    <figure className={cn("image-placeholder relative grid place-items-center overflow-hidden", className)}>
      <ImageIcon aria-hidden="true" className="size-9 text-green/60" strokeWidth={1.25} />
      {compact ? (
        // Small tag for tiles whose own title already names the subject
        <figcaption className="absolute top-0 left-0 z-10 border-r border-b border-border bg-white px-3 py-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          Photo to be supplied
          <span className="sr-only"> — {label}</span>
        </figcaption>
      ) : (
        <figcaption className="absolute bottom-0 left-0 z-10 max-w-[85%] border-t border-r border-border bg-white px-3.5 py-2 text-[0.6875rem] font-semibold uppercase leading-snug tracking-[0.12em] text-walnut">
          <span className="text-text-muted">Photograph to be supplied</span>
          <br />
          {label}
        </figcaption>
      )}
    </figure>
  );
}
