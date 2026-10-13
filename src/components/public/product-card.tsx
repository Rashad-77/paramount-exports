import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { formatMoney } from "@/lib/money";

/** Photograph first, then the name, a line of detail, the price and a link: the way a showroom label sits beside a piece. */
export function ProductCard({ product, currency, priority = false }: { product: PublicCard; currency: string; priority?: boolean }) {
  const meta = [product.categoryName, product.material, product.availability].filter(Boolean).join(" · ");
  return (
    <article className="group h-full bg-[#f4f4f3]">
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
        <div className="px-4 pb-5 pt-4">
          <h3 className="font-display text-[1.2rem] leading-snug text-text">
            <span>{product.name}</span>
          </h3>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-text-muted">{meta}</p>
          <p className="mt-4 text-sm font-medium text-text">{product.fromPrice ? `From ${formatMoney(product.fromPrice, currency)}` : "Price on request"}</p>
        </div>
      </Link>
    </article>
  );
}
