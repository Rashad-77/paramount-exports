import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { formatMoney } from "@/lib/money";

export function ProductCard({ product, currency, priority = false }: { product: PublicCard; currency: string; priority?: boolean }) {
  const meta = [product.material, product.fromPrice ? `From ${formatMoney(product.fromPrice, currency)}` : null, product.availability].filter(Boolean).join(" · ");
  return (
    <article className="group">
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
        <p className="eyebrow mt-5 !gap-0 !text-[0.6875rem] before:hidden">{product.categoryName}</p>
        <h3 className="font-display mt-1.5 text-[1.5rem] leading-tight text-walnut">
          <span className="link-draw-hover">{product.name}</span>
        </h3>
      </Link>
      {meta ? <p className="mt-1.5 text-sm text-text-muted">{meta}</p> : null}
    </article>
  );
}
