"use client";

import { useState, type ReactNode } from "react";
import { SiteImage } from "./site-image";
import { ImagePlaceholder } from "./image-placeholder";
import { cn } from "@/lib/cn";

const SLOTS = 5;

/**
 * The main photograph with a row of square frames under it. Every frame can be pressed: a frame holding a photograph shows it large,
 * and a frame still waiting for a photograph shows the placeholder, so the row always shows where more pictures go.
 */
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
  const total = Math.max(SLOTS, images.length);
  const current = images[active];
  return (
    <div>
      {saleLabel ? <p className="sale-tag">{saleLabel}</p> : null}
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {current ? (
          <SiteImage
            src={current.url}
            alt={current.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <ImagePlaceholder
            label={`${name} — photograph to be added`}
            className="absolute inset-0"
          />
        )}
        {heart}
      </div>
      <ul
        className="mt-3 grid grid-cols-5 gap-2"
        aria-label="Product photographs"
      >
        {Array.from({ length: total }, (_, i) => {
          const img = images[i];
          return (
            <li key={img?.id ?? `empty-${i}`}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={
                  img
                    ? `Show photograph ${i + 1} of ${images.length}`
                    : `Photograph ${i + 1}: not added yet`
                }
                aria-pressed={i === active}
                className={cn(
                  "relative block aspect-square w-full cursor-pointer overflow-hidden border",
                  img ? "bg-linen" : "border-dashed bg-linen/60",
                  i === active
                    ? "border-walnut border-2"
                    : "border-border hover:border-walnut",
                )}
              >
                {img ? (
                  <SiteImage
                    src={img.url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
