"use client";

import { useState, type ReactNode } from "react";
import { SiteImage } from "./site-image";
import { ImagePlaceholder } from "./image-placeholder";
import { cn } from "@/lib/cn";

/**
 * The main photograph with a row of square frames under it, one per photograph. Pressing a frame shows that photograph large. Each frame
 * is a fifth of the row wide, and the frames are centred, so fewer than five photographs leave no empty frames.
 */
export function ProductGallery({
  images,
  name,
  heart,
  saleLabel,
  premium = false,
}: {
  images: Array<{ id: string; url: string; alt: string }>;
  name: string;
  heart?: ReactNode;
  saleLabel?: string;
  /** A piece of the premium range: a Premium range tag runs above the photograph, as wide as it. */
  premium?: boolean;
}) {
  const [active, setActive] = useState(0);
  return (
    <div>
      {premium ? <p className="premium-tag">Premium range</p> : null}
      {saleLabel ? <p className="sale-tag">{saleLabel}</p> : null}
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        {images.length > 0 ? (
          // Every photograph is stacked here and only the chosen one is visible: the others are fetched quietly once the page has loaded,
          // so pressing a frame shows its photograph at once instead of waiting for it.
          images.map((img, i) => (
            <SiteImage
              key={img.id}
              src={img.url}
              alt={i === active ? img.alt : ""}
              fill
              priority={i === 0}
              loading={i === 0 ? undefined : "eager"}
              fetchPriority={i === 0 ? undefined : "low"}
              sizes="(min-width: 1024px) 50vw, 100vw"
              aria-hidden={i === active ? undefined : true}
              className={cn(
                "object-cover transition-opacity duration-300 motion-reduce:transition-none",
                i === active ? "opacity-100" : "opacity-0",
              )}
            />
          ))
        ) : (
          <ImagePlaceholder
            label={`${name} — photograph to be added`}
            className="absolute inset-0"
          />
        )}
        {heart}
      </div>
      {images.length > 0 ? (
        <ul
          className="mt-3 flex flex-wrap justify-center gap-2"
          aria-label="Product photographs"
        >
          {images.map((img, i) => (
            <li key={img.id} className="w-[calc((100%-2rem)/5)]">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photograph ${i + 1} of ${images.length}`}
                aria-pressed={i === active}
                className={cn(
                  "relative block aspect-square w-full cursor-pointer overflow-hidden border bg-linen",
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
          ))}
        </ul>
      ) : null}
    </div>
  );
}
