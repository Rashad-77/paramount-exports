import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { SiteImage } from "./site-image";
import type { PublicCard } from "@/server/catalogue-public";
import { formatMoney } from "@/lib/money";
import { percentOff } from "@/lib/sale";
import { WishlistButton } from "./wishlist-button";

/** Photograph first, then the name, a line of detail, the price and a link: the way a showroom label sits beside a piece. */
export function ProductCard({ product, currency, priority = false, wishlist = false }: { product: PublicCard; currency: string; priority?: boolean; wishlist?: boolean }) {
  const off = percentOff(product.fromPrice, product.fromCompare);
  return (
    <article className="group pcard relative h-full">
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
          {product.isNew ? <span className="new-badge">New</span> : null}
          {off ? <span className="sale-badge">Sale · {off}% off</span> : null}
        </div>
        <div className="pcard-body px-4 pb-5 pt-4">
          <h3 className="font-display text-text">
            <span>{product.name}</span>
          </h3>
          <p className="pcard-price font-medium text-text">
            {product.fromPrice ? (
              off && product.fromCompare ? (
                <>
                  <del className="price-was">{formatMoney(product.fromCompare, currency)}</del>
                  <ins className="price-now">{formatMoney(product.fromPrice, currency)}</ins>
                </>
              ) : (
                `From ${formatMoney(product.fromPrice, currency)}`
              )
            ) : (
              "Price on request"
            )}
          </p>
        </div>
      </Link>
      {wishlist ? <WishlistButton productId={product.id} slug={product.slug} variant="icon" /> : null}
    </article>
  );
}
