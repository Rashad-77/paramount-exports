import { cn } from "@/lib/cn";

/**
 * Flat grey block standing in for client photography. It says so on its face (small blocks say it only to screen readers) and is
 * replaced by the real <Image> as soon as a photograph is uploaded.
 */
export function ImagePlaceholder({ label, className, compact = false }: { label: string; className?: string; compact?: boolean }) {
  return (
    <figure className={cn("image-placeholder grid place-items-center overflow-hidden", className)}>
      <figcaption className={compact ? "sr-only" : "px-4 text-center text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[#55554f]"}>
        Photo to be supplied
        <span className="sr-only"> — {label}</span>
      </figcaption>
    </figure>
  );
}
