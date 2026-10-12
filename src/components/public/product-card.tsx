import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { formatMoney } from "@/lib/money";

/** A raised, mounted-print style container: image inset in a bordered card that lifts on hover. */
export function ProductCard({ product, currency, priority = false }: { product: PublicCard; currency: string; priority?: boolean }) {
  const meta = [product.material, product.fromPrice ? `From ${formatMoney(product.fromPrice, currency)}` : null, product.availability].filter(Boolean).join(" · ");
  return (
    <article className="group card-lift glass h-full p-2.5">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="zoom-frame relative aspect-[4/5]">
          {product.imageUrl ? (
            <SiteImage
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              priority={priority}
              className="object-cover"
            />
          ) : (
            <ImagePlaceholder label={product.name} className="absolute inset-0" />
          )}
        </div>
        <div className="flex items-start justify-between gap-4 px-1 pt-3.5 pb-1.5">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-text-muted">{product.categoryName}</p>
            <h3 className="font-display mt-1.5 text-[1.125rem] leading-snug text-walnut">
              <span className="link-draw-hover">{product.name}</span>
            </h3>
            {meta ? <p className="mt-1 text-[0.8125rem] text-text-muted">{meta}</p> : null}
          </div>
          <ArrowUpRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-green-text transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:translate-x-1 group-hover:-translate-y-1" strokeWidth={1.5} />
        </div>
      </Link>
    </article>
  );
}
