import type { Metadata } from "next";
import { CartView } from "@/components/public/cart-view";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { ProductCard } from "@/components/public/product-card";
import { PageIntro } from "@/components/public/prose";
import { ScrollRow } from "@/components/public/scroll-row";
import { getBusinessSettings } from "@/lib/settings";
import { listPublicProducts } from "@/server/catalogue-public";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };
export const revalidate = 300;

const CARDS = 8;
/** The row always shows at least this many cards; the ones with no piece behind them stay as empty frames (a piece is never shown twice). */
const MIN_TILES = 5;
const CARD_W = "w-[62%] shrink-0 sm:w-[32%] lg:w-[23%]";

export default async function CartPage() {
  const [business, products] = await Promise.all([getBusinessSettings(), listPublicProducts({ sort: "newest" }).then((r) => r.items.slice(0, CARDS))]);

  // Shown only while the cart is empty (the cart decides, in the browser): a row of pieces to start from.
  const tiles = products.length > 0 ? Array.from({ length: Math.max(products.length, MIN_TILES) }, (_, n) => ({ n, p: products[n] ?? null })) : [];
  const suggestions = products.length > 0 ? (
    <section aria-labelledby="suggest-title" className="border-t border-border bg-white pb-16 pt-14">
      <ScrollRow
        label="Pieces from the collection"
        autoplay
        pxPerSecond={20}
        centered
        header={
          <div className="max-w-2xl">
            <p className="eyebrow">Start with a piece</p>
            <h2 id="suggest-title" className="font-display mt-3 text-headline text-text">
              From our collection
            </h2>
          </div>
        }
      >
        {tiles.map((t) =>
          t.p ? (
            <div key={t.n} className={CARD_W}>
              <ProductCard product={t.p} currency={business.currency} />
            </div>
          ) : (
            // An empty frame where a piece will go: the same photograph area as a card, with nothing in it.
            <div key={t.n} aria-hidden="true" className={CARD_W}>
              <div className="relative aspect-[4/5]">
                <ImagePlaceholder label="" className="absolute inset-0" />
              </div>
            </div>
          ),
        )}
      </ScrollRow>
    </section>
  ) : null;

  return (
    <>
      <PageIntro back={{ href: "/products", to: "the collection" }} plain title="Your cart" lead="Check what you have chosen." eyebrow="Cart" />
      <CartView currency={business.currency} suggestions={suggestions} />
    </>
  );
}
