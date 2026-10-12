import { cn } from "@/lib/cn";

const TONES = ["wood-a", "wood-b", "wood-c", "wood-d"] as const;

/** Stable pick so the same label always gets the same panel, while neighbours differ. */
function toneFor(label: string): (typeof TONES)[number] {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length]!;
}

/**
 * Generative timber panel standing in for client photography. It is honest about being a placeholder (the caption says so) and is
 * replaced by the real <Image> as soon as a photograph is uploaded.
 */
export function ImagePlaceholder({ label, className, tone, compact = false }: { label: string; className?: string; tone?: (typeof TONES)[number]; compact?: boolean }) {
  return (
    <figure className={cn("wood relative overflow-hidden", tone ?? toneFor(label), className)}>
      {compact ? (
        // Small tag for tiles whose own title already names the subject
        <figcaption className="absolute top-0 left-0 z-10 bg-walnut-dark px-3 py-1.5 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-linen-dark">
          Photo to be supplied
          <span className="sr-only"> — {label}</span>
        </figcaption>
      ) : (
        <figcaption className="absolute bottom-0 left-0 z-10 max-w-[85%] bg-walnut-dark px-3.5 py-2 text-[0.6875rem] font-medium uppercase leading-snug tracking-[0.14em] text-ivory">
          <span className="text-linen-dark">Photograph to be supplied</span>
          <br />
          {label}
        </figcaption>
      )}
    </figure>
  );
}
