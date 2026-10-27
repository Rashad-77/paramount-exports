import type { Metadata } from "next";
import { Store, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/public/back-link";
import { AskDisclosure } from "@/components/public/ask-disclosure";
import { AvailabilityTag } from "@/components/public/availability-tag";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ProductCard } from "@/components/public/product-card";
import { ProductGallery } from "@/components/public/product-gallery";
import { ProductTabs, type ProductTab } from "@/components/public/product-tabs";
import { PurchasePanel } from "@/components/public/purchase-panel";
import { WishlistButton } from "@/components/public/wishlist-button";
import { customerAuthMode } from "@/lib/auth/customer";
import { publicEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { saleLabel } from "@/lib/sale";
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
    ...(prices.length ? { offers: { "@type": "Offer", priceCurrency: business.currency, price: prices[0], url: `${site}/products/${p.slug}`, ...(availabilityLd ? { availability: availabilityLd } : {}), seller: { "@id": `${site}/#business` } } } : {}),
  };
  const crumbs = breadcrumbLd(site, [
    { name: "Home", path: "/" },
    { name: "Collection", path: "/products" },
    { name: p.categoryName, path: `/products?category=${encodeURIComponent(p.categorySlug)}` },
    { name: p.name, path: `/products/${p.slug}` },
  ]);

  // A sale: the label says the amount or the percentage, as the owner entered the discount.
  const sale = saleLabel({ kind: p.discountKind, value: p.discountValue }, line?.price, line?.compare, (a) => formatMoney(a, business.currency));

  // The line under the name: the short description, or else the opening of the detailed one.
  // Under the name: only the short description. The long one, with the features and uses, is the first bar below.
  const lead = p.shortDescription;

  // Only what applies to this piece is shown: an empty section never appears. The type comes first, then the rows staff added.
  const specs: Array<{ label: string; value: string }> = [
    { label: "Type", value: p.kind === "made_to_order" ? "Made to order" : "Ready-made" },
    ...p.specifications.map((s) => ({ label: s.label, value: specText(s) })),
  ].filter((s) => s.value);

  const tabs: ProductTab[] = [];
  if (p.description) {
    tabs.push({
      id: "description",
      label: "Description",
      content: (
        <div className="pdp-prose">
          {p.description ? <p className="whitespace-pre-line">{p.description}</p> : null}
        </div>
      ),
    });
  }
  if (specs.length) {
    tabs.push({
      id: "specifications",
      label: "Specifications",
      content: (
        <dl className="pdp-specs">
          {specs.map((s) => (
            <div key={s.label + s.value}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  }
  const addressLines = (business.address ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/[,\s]+$/, ""))
    .filter(Boolean);
  const hours = (business.openingHours ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  tabs.push({
    id: "delivery",
    label: "Delivery and collection",
    content: (
      <ul className="pdp-info">
        <li>
          <Truck aria-hidden="true" strokeWidth={1.5} />
          <div>
            <h3>Delivery</h3>
            <p>We deliver to your address. The delivery charge is agreed with you when we confirm your order.</p>
            <p>
              <strong className="font-medium text-text">Estimated delivery:</strong> 3 to 7 working days after your order is confirmed.
            </p>
          </div>
        </li>
        <li>
          <Store aria-hidden="true" strokeWidth={1.5} />
          <div>
            <h3>Collect from the showroom</h3>
            <p>Collection is free. We will tell you when your order is ready.</p>
            {addressLines.length ? (
              <address>
                {addressLines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </address>
            ) : null}
            {hours.length ? (
              <p className="pdp-hours">
                {hours.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </p>
            ) : null}
            {business.mapUrl ? (
              <a href={business.mapUrl} target="_blank" rel="noopener noreferrer" className="pdp-directions">
                Get directions
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </li>
      </ul>
    ),
  });

  return (
    <div className="pdp-page">
      {sale ? <p className="sale-bar">{sale}</p> : null}
      <div className="container-page pb-8 pt-2 md:pb-14 md:pt-3">
        <JsonLd data={[jsonLd, crumbs]} />
        <div className="mb-3">
          <BackLink href="/products" to="the collection" tone="dark" history />
        </div>
        <div className="grid gap-10 md:grid-cols-2 md:gap-8 lg:gap-14">
          <div className="md:sticky md:top-24 md:self-start">
            <ProductGallery
              images={p.images}
              name={p.name}
              premium={p.isPremium}
              heart={accountsOn ? <WishlistButton productId={p.id} slug={p.slug} variant="icon" size="photo" /> : undefined}
            />
          </div>
          <div>
            <p className="pdp-category text-text-muted">{p.categoryName}</p>
            <h1 className="font-display mt-3 text-headline text-walnut">{p.name}</h1>
            {p.availability && p.availabilityState ? (
              <p className="mt-4">
                <AvailabilityTag state={p.availabilityState}>{p.availability}</AvailabilityTag>
              </p>
            ) : null}
            {lead ? <p className="pdp-lead mt-5 max-w-prose whitespace-pre-line text-text-muted">{lead}</p> : null}

            <PurchasePanel
              productName={p.name}
              productSlug={p.slug}
              image={p.images[0]?.url ?? null}
              currency={business.currency}
              madeToOrder={p.kind === "made_to_order"}
              option={line ? { id: line.id, label: line.label, sku: line.sku, price: line.price, compare: line.compare, stock: line.stock } : null}
            />
          </div>
        </div>

        <div className="mt-4 md:mt-20">
          <ProductTabs tabs={tabs} />
        </div>

        <AskDisclosure title="Have a question?" text="We reply within one working day." openLabel={prices.length ? "Ask a question" : "Enquire about this piece"}>
          <EnquiryForm
            kind="product_enquiry"
            wide
            productId={p.id}
            turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            submitLabel="Send enquiry"
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
      </div>
    </div>
  );
}
