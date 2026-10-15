import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { Price } from "./price";
import { WishlistButton } from "./wishlist-button";

/** Photograph first, details underneath: the way a showroom label sits beside a piece. */
export function ProductCard({ product, currency, priority = false }: { product: PublicCard; currency: string; priority?: boolean }) {
  const meta = [product.material, product.availability].filter(Boolean).join(" · ");
  return (
    <article className="group relative h-full">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative">
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
          {product.salePrice ? <span className="badge-sale">Sale</span> : null}
        </div>
        <div className="pt-3.5">
          <p className="text-[0.75rem] text-text-muted">{product.categoryName}</p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug text-text">
            <span>{product.name}</span>
          </h3>
          <p className="mt-1 text-sm font-semibold text-brand">
            {product.fromPrice ? <Price price={product.fromPrice} salePrice={product.salePrice} currency={currency} from /> : "Price on request"}
          </p>
          {meta ? <p className="mt-0.5 text-[0.8125rem] text-text-muted">{meta}</p> : null}
        </div>
      </Link>
      <WishlistButton productId={product.id} name={product.name} />
    </article>
  );
}
