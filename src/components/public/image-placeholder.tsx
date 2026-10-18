import { cn } from "@/lib/cn";

/**
 * Flat grey block standing in for a photograph that has not been added yet. It carries no wording on screen (only its label, for
 * screen readers) and is replaced by the real <Image> as soon as a photograph is uploaded.
 */
export function ImagePlaceholder({ label, className }: { label: string; className?: string; compact?: boolean }) {
  return (
    <figure className={cn("image-placeholder grid place-items-center overflow-hidden", className)}>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
