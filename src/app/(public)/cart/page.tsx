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
const CARD_W = "w-[62%] shrink-0 sm:w-[32%] lg:w-[23%]";

export default async function CartPage() {
  const [business, products] = await Promise.all([getBusinessSettings(), listPublicProducts({ sort: "newest" }).then((r) => r.items.slice(0, CARDS))]);

  // Shown only while the cart is empty (the cart decides, in the browser): a row of pieces to start from.
  const suggestions = (
    <section aria-labelledby="suggest-title" className="border-t border-border bg-white pb-16 pt-14">
      <ScrollRow
        label="Pieces from the collection"
        autoplay
        header={
          <div className="max-w-2xl">
            <p className="eyebrow">Start with a piece</p>
            <h2 id="suggest-title" className="font-display mt-3 text-headline text-text">
              From our collection
            </h2>
          </div>
        }
      >
        {products.map((p) => (
          <div key={p.id} className={CARD_W}>
            <ProductCard product={p} currency={business.currency} />
          </div>
        ))}
        {Array.from({ length: Math.max(0, CARDS - products.length) }, (_, i) => (
          <div key={`ph-${i}`} className={CARD_W}>
            <div className="h-full border border-black">
              <ImagePlaceholder label="Product photograph" className="aspect-[4/5] w-full" compact />
              <div className="px-4 pb-5 pt-4">
                <p className="font-display text-[1.2rem] leading-snug text-text">Product to be added</p>
                <p className="mt-1.5 text-[0.8125rem] text-text-muted">Details to be supplied</p>
              </div>
            </div>
          </div>
        ))}
      </ScrollRow>
    </section>
  );

  return (
    <>
      <PageIntro plain title="Your cart" lead="Check what you have chosen." eyebrow="Cart" />
      <CartView currency={business.currency} suggestions={suggestions} />
    </>
  );
}
