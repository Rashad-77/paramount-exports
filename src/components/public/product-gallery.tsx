"use client";

import { useState } from "react";
import { SiteImage } from "./site-image";
import { ImagePlaceholder } from "./image-placeholder";
import { cn } from "@/lib/cn";

export function ProductGallery({ images, name }: { images: Array<{ id: string; url: string; alt: string }>; name: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return <ImagePlaceholder label={`${name} — product photographs to be added`} className="aspect-[4/5] w-full" />;
  const current = images[active]!;
  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-border bg-linen">
        <SiteImage src={current.url} alt={current.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-label="Product photographs">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photograph ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={cn("relative block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] border bg-linen", i === active ? "border-walnut border-2" : "border-border hover:border-walnut")}
              >
                <SiteImage src={img.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
