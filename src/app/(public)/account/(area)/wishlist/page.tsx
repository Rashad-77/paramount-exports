import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Empty, SectionHead } from "@/components/public/account-ui";
import { ProductCard } from "@/components/public/product-card";
import { WishlistButton } from "@/components/public/wishlist-button";
import { requireCustomer } from "@/lib/auth/customer";
import { getBusinessSettings } from "@/lib/settings";
import { listWishlist } from "@/server/accounts";

export const metadata: Metadata = { title: "Wishlist" };

export default async function AccountWishlistPage() {
  const customer = await requireCustomer("/account/wishlist");
  const [items, business] = await Promise.all([listWishlist(customer.id), getBusinessSettings()]);
  return (
    <section aria-labelledby="wish-title" className="acct-card">
      <SectionHead id="wish-title" title="Wishlist" />
      {items.length === 0 ? (
        <Empty
          actions={
            <ButtonLink href="/products" size="cta">
              Browse the collection
            </ButtonLink>
          }
        >
          Products you save appear here, so you can come back to them. Use “Save to wishlist” on any product page.
        </Empty>
      ) : (
        <ul className="acct-wish">
          {items.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} currency={business.currency} />
              <WishlistButton productId={p.id} initiallySaved variant="remove" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
