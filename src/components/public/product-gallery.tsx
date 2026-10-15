"use client";

import { useState, type ReactNode } from "react";
import { SiteImage } from "./site-image";
import { ImagePlaceholder } from "./image-placeholder";
import { cn } from "@/lib/cn";

const SLOTS = 5;

/** Empty square frames for photographs that have not been added yet, so the row always shows where more pictures go. */
function EmptySlots({ from }: { from: number }) {
  return Array.from({ length: Math.max(0, SLOTS - from) }, (_, i) => (
    <li key={`empty-${i}`} aria-hidden="true">
      <div className="aspect-square w-full border border-dashed border-border bg-linen/60" />
    </li>
  ));
}

export function ProductGallery({
  images,
  name,
  heart,
  saleLabel,
}: {
  images: Array<{ id: string; url: string; alt: string }>;
  name: string;
  heart?: ReactNode;
  saleLabel?: string;
}) {
  const [active, setActive] = useState(0);
  if (images.length === 0)
    return (
      <div>
        {saleLabel ? <p className="sale-tag">{saleLabel}</p> : null}
        <div className="relative">
          <ImagePlaceholder
            label={`${name} — product photographs to be added`}
            className="aspect-[4/5] w-full"
          />
          {heart}
        </div>
        <ul className="mt-3 grid grid-cols-5 gap-2" aria-hidden="true">
          <EmptySlots from={0} />
        </ul>
      </div>
    );
  const current = images[active]!;
  return (
    <div>
      {saleLabel ? <p className="sale-tag">{saleLabel}</p> : null}
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        <SiteImage
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        {heart}
      </div>
      <ul
        className="mt-3 grid grid-cols-5 gap-2"
        aria-label="Product photographs"
      >
        {images.length > 1
          ? images.map((img, i) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show photograph ${i + 1} of ${images.length}`}
                  aria-pressed={i === active}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden border bg-linen",
                    i === active
                      ? "border-walnut border-2"
                      : "border-border hover:border-walnut",
                  )}
                >
                  <SiteImage
                    src={img.url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </button>
              </li>
            ))
          : images.map((img) => (
              <li key={img.id}>
                <div className="relative block aspect-square w-full overflow-hidden border-2 border-walnut bg-linen">
                  <SiteImage
                    src={img.url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              </li>
            ))}
        <EmptySlots from={images.length} />
      </ul>
    </div>
  );
}
