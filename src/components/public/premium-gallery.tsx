"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/cn";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";

const pad =(n: number) => String(n).padStart(2, "0");

/**
 * A large rectangular photograph with the row of square frames under it, as on the product pages: pressing a frame cross-fades to that
 * photograph. There is one frame per photograph, a fifth of the row wide and centred, so fewer than five leave no empty frames.
 */
export const PremiumGallery = memo(function PremiumGallery({ images, name, priority = false }: { images: Array<{ id: string; url: string; alt: string; x?: number; y?: number }>; name: string; priority?: boolean }) {
  const [active, setActive] = useState(0);
  /** The photograph being faded out: it stays in place under the new one until the fade is done, so the picture never dips to black. */
  const [prev, setPrev] = useState<number | null>(null);
  const show = (i: number) => {
    if (i === active) return;
    setPrev(active);
    setActive(i);
  };
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
              style={{ objectPosition: `${img.x ?? 50}% ${img.y ?? 50}%` }}
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
      {images.length > 0 ? (
        <ul className="pg-thumbs" aria-label={`${name} photographs`}>
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={`Show photograph ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={cn("pg-thumb", i === active && "is-on")}
              >
                <SiteImage src={img.url} alt="" fill sizes="96px" className="object-cover" style={{ objectPosition: `${img.x ?? 50}% ${img.y ?? 50}%` }} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
