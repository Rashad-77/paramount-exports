"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";

const SLOTS = 5;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A large rectangular photograph with the row of square frames under it, as on the product pages: pressing a frame cross-fades to that
 * photograph. Frames still waiting for a photograph stay as dashed outlines, so the row always shows where more pictures go.
 */
export function PremiumGallery({ images, name, priority = false }: { images: Array<{ id: string; url: string; alt: string }>; name: string; priority?: boolean }) {
  const [active, setActive] = useState(0);
  /** The photograph being faded out: it stays in place under the new one until the fade is done, so the picture never dips to black. */
  const [prev, setPrev] = useState<number | null>(null);
  const show = (i: number) => {
    if (i === active) return;
    setPrev(active);
    setActive(i);
  };
  const total = Math.max(SLOTS, images.length);
  return (
    <div className="pg">
      <div className="pg-main">
        {images.length > 0 ? (
          images.map((img, i) => (
            <SiteImage
              key={img.id}
              src={img.url}
              alt={img.alt || name}
              fill
              priority={priority && i === 0}
              sizes="(min-width: 1024px) 40rem, (min-width: 768px) 50vw, 100vw"
              className="pg-img object-cover"
              data-on={i === active ? "" : undefined}
              data-prev={i === prev && i !== active ? "" : undefined}
              aria-hidden={i === active ? undefined : true}
            />
          ))
        ) : (
          <ImagePlaceholder label={`${name} — photograph to be added`} className="absolute inset-0" />
        )}
        {images.length > 1 ? (
          <span className="pg-count" aria-hidden="true">
            {pad(active + 1)} <i>/</i> {pad(images.length)}
          </span>
        ) : null}
      </div>
      <ul className="pg-thumbs" aria-label={`${name} photographs`}>
        {Array.from({ length: total }, (_, i) => {
          const img = images[i];
          return (
            <li key={img?.id ?? `empty-${i}`}>
              <button
                type="button"
                onClick={() => (img ? show(i) : undefined)}
                aria-label={img ? `Show photograph ${i + 1} of ${images.length}` : `Photograph ${i + 1}: not added yet`}
                aria-pressed={i === active}
                aria-disabled={img ? undefined : true}
                className={cn("pg-thumb", !img && "is-empty", i === active && "is-on")}
              >
                {img ? <SiteImage src={img.url} alt="" fill sizes="96px" className="object-cover" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
