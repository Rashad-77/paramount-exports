import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AskDisclosure } from "@/components/public/ask-disclosure";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ProductCard } from "@/components/public/product-card";
import { ProductView } from "@/components/public/product-view";
import { WishlistButton } from "@/components/public/wishlist-button";
import { customerAuthMode } from "@/lib/auth/customer";
import { publicEnv } from "@/lib/env";
import { JsonLd } from "@/components/json-ld";
import { specText } from "@/lib/specifications";
import { breadcrumbLd } from "@/lib/structured-data";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { getPublicProduct, listRelatedProducts } from "@/server/catalogue-public";

export const revalidate = 300;

/**
 * No product page is built ahead of time, but each one is built the first time it is visited and then kept (for 5 minutes, or until the
 * dashboard or an order changes it). Without this, Next.js ignores `revalidate` for an address like /products/<name> and rebuilds
 * the page for every visitor.
 */
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicProduct((await params).slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = p.seoDescription ?? p.shortDescription ?? p.description?.slice(0, 160) ?? `${p.name} — ${p.categoryName}`;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.seoTitle ?? p.name, description, type: "website", images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, business, accounts] = await Promise.all([getPublicProduct(slug), getBusinessSettings(), getAccountSettings()]);
  if (!p) notFound();
  const accountsOn = accounts.enabled && customerAuthMode() !== "off";
  const related = await listRelatedProducts(p.id, p.categoryId, 4);

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  // A product has one price line (the first), which is what is sold.
  const line = p.variants[0] ?? null;
  const prices = line?.price ? [line.price] : [];
  const availabilityLd = p.availabilityState === "in_stock" ? "https://schema.org/InStock" : p.availabilityState === "sold" ? "https://schema.org/OutOfStock" : p.availabilityState === "made_to_order" ? "https://schema.org/PreOrder" : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${site}/products/${p.slug}#product`,
    name: p.name,
    description: p.shortDescription ?? p.description ?? undefined,
    sku: p.variants[0]?.sku,
    material: p.material ?? undefined,
    category: p.categoryName,
    brand: { "@type": "Brand", name: business.name },
    manufacturer: { "@id": `${site}/#business` },
    image: p.images.map((i) => i.url),
    url: `${site}/products/${p.slug}`,
    // What the page lists under Specifications, so a search engine or an AI assistant can quote the details.
    additionalProperty: [
      ...(p.dimensions ? [{ "@type": "PropertyValue", name: "Dimensions", value: p.dimensions }] : []),
      ...p.specifications.map((s) => ({ "@type": "PropertyValue", name: s.label, value: specText(s) })).filter((s) => s.value),
    ],
    // Only describe an offer when the business chose to show prices publicly.
    ...(prices.length ? { offers: { "@type": "Offer", priceCurrency: business.currency, price: prices[0], itemCondition: "https://schema.org/NewCondition", url: `${site}/products/${p.slug}`, ...(availabilityLd ? { availability: availabilityLd } : {}), seller: { "@id": `${site}/#business` } } } : {}),
  };
  const crumbs = breadcrumbLd(site, [
    { name: "Home", path: "/" },
    { name: "Collection", path: "/products" },
    { name: p.categoryName, path: `/collections/${encodeURIComponent(p.categorySlug)}` },
    { name: p.name, path: `/products/${p.slug}` },
  ]);

  return (
    <ProductView
      p={p}
      shop={business}
      heart={accountsOn ? <WishlistButton productId={p.id} slug={p.slug} variant="icon" size="photo" /> : undefined}
    >
      <JsonLd data={[jsonLd, crumbs]} />
      <AskDisclosure
        title={prices.length ? "Have a question?" : "Request a quotation"}
        text={prices.length ? "We reply within one working day." : "Tell us the size and the amount you need. We reply with a quotation within one working day."}
        openLabel={prices.length ? "Ask a question" : "Request quotation"}
      >
        <EnquiryForm
          kind={prices.length ? "product_enquiry" : "custom"}
          quoteFor={prices.length ? undefined : p.name}
          wide
          productId={p.id}
          turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          submitLabel={prices.length ? "Send enquiry" : "Request quotation"}
        />
      </AskDisclosure>

      {related.length ? (
        <section aria-labelledby="related-title" className="mt-16 md:mt-24">
          <h2 id="related-title" className="font-display text-[clamp(1.225rem,calc(1.225rem_+_(100vw_-_375px)_*_0.02137),1.75rem)] leading-tight text-walnut">
            You may also like
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id}>
                <ProductCard product={r} currency={business.currency} wishlist={accountsOn} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ProductView>
  );
}
