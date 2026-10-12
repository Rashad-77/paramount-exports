import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { formatMoney } from "@/lib/money";

export function ProductCard({ product, currency, priority = false }: { product: PublicCard; currency: string; priority?: boolean }) {
  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-border bg-linen">
          {product.imageUrl ? (
            <SiteImage
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              priority={priority}
              className="object-cover transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)] group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <ImagePlaceholder label={product.name} className="absolute inset-0 rounded-none border-0" />
          )}
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-text-muted">{product.categoryName}</p>
        <h3 className="font-display mt-1 text-xl text-walnut group-hover:underline underline-offset-4">{product.name}</h3>
      </Link>
      <p className="mt-1 text-sm text-text-muted">
        {[product.material, product.fromPrice ? `From ${formatMoney(product.fromPrice, currency)}` : null, product.availability].filter(Boolean).join(" · ")}
      </p>
    </article>
  );
}
