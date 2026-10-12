import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Clearly-labelled stand-in for client photography. It never pretends to be a real photo. Replace with the
 * real <Image> once the client supplies pictures (uploaded via the admin in a later step).
 */
export function ImagePlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <figure
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-linen",
        "bg-[repeating-linear-gradient(135deg,transparent_0,transparent_14px,rgb(73_55_44/0.05)_14px,rgb(73_55_44/0.05)_15px)]",
        className,
      )}
    >
      <figcaption className="flex flex-col items-center gap-2 px-6 text-center text-sm text-text-muted">
        <ImageIcon aria-hidden="true" className="size-6 text-stone" strokeWidth={1.25} />
        <span>
          <span className="font-medium text-text">Photograph placeholder</span>
          <br />
          {label}
        </span>
      </figcaption>
    </figure>
  );
}
