import type { Metadata } from "next";
import { Store, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/public/back-link";
import { AskDisclosure } from "@/components/public/ask-disclosure";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ProductCard } from "@/components/public/product-card";
import { ProductGallery } from "@/components/public/product-gallery";
import { ProductTabs, type ProductTab } from "@/components/public/product-tabs";
import { PurchasePanel } from "@/components/public/purchase-panel";
import { quoteHref } from "@/lib/quote-link";
import { WishlistButton } from "@/components/public/wishlist-button";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { customerAuthMode } from "@/lib/auth/customer";
import { publicEnv } from "@/lib/env";
import { percentOff } from "@/lib/sale";
import { CUSTOMIZATIONS, CUSTOMIZATION_LABEL } from "@/lib/schemas/catalogue";
import { specText } from "@/lib/specifications";
import { getAccountSettings, getBusinessSettings } from "@/lib/settings";
import { getPublicProduct, listRelatedProducts } from "@/server/catalogue-public";

export const revalidate = 300;

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

const List = ({ items }: { items: string[] }) => (
  <ul className="pdp-list">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, business, accounts] = await Promise.all([getPublicProduct(slug), getBusinessSettings(), getAccountSettings()]);
  if (!p) notFound();
  const accountsOn = accounts.enabled && customerAuthMode() !== "off";
  const related = await listRelatedProducts(p.id, p.categoryId, 4);

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const prices = p.variants.map((v) => v.price).filter((x): x is string => Boolean(x));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.shortDescription ?? p.description ?? undefined,
    sku: p.variants[0]?.sku,
    material: p.material ?? undefined,
    image: p.images.map((i) => i.url),
    url: `${site}/products/${p.slug}`,
    // Only describe an offer when the business chose to show prices publicly.
    ...(prices.length ? { offers: { "@type": "Offer", priceCurrency: business.currency, price: prices[0] } } : {}),
  };

  // A sale: the best discount among the options that are on sale.
  const bestOff = p.variants.reduce<number | null>((best, v) => {
    const off = percentOff(v.price, v.compare);
    return off && (!best || off > best) ? off : best;
  }, null);

  // The line under the name: the short description, or else the opening of the detailed one.
  // Under the name: only the short description. The long one, with the features and uses, is the first bar below.
  const lead = p.shortDescription;

  const quote = { productId: p.id, name: p.name, wood: p.material, finish: p.finish, size: p.dimensions };

  // Only what applies to this piece is shown: an empty section never appears. The type comes first, then the rows staff added.
  const specs: Array<{ label: string; value: string }> = [
    { label: "Type", value: p.kind === "made_to_order" ? "Made to order" : "Ready-made" },
    ...p.specifications.map((s) => ({ label: s.label, value: specText(s) })),
  ].filter((s) => s.value);

  const customs = CUSTOMIZATIONS.filter((c) => p.customization.includes(c));

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
  if (customs.length) {
    tabs.push({
      id: "customization",
      label: "Customization",
      content: (
        <div className="pdp-prose">
          <p>This piece can be made to suit you. You can ask us for:</p>
          <List items={customs.map((c) => CUSTOMIZATION_LABEL[c])} />
          <p>Tell us what you need and we will send a price. There is no obligation.</p>
          <ButtonLink href={quoteHref(quote)} size="cta">
            Request a quote to customize
          </ButtonLink>
        </div>
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
      {bestOff ? <p className="sale-bar">Sale · save up to {bestOff}%</p> : null}
      <div className="container-page pb-8 pt-2 md:pb-14 md:pt-3">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <div className="mb-3">
          <BackLink href="/products" to="the collection" tone="dark" history />
        </div>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
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
            {p.availability ? (
              <p className="mt-4">
                <StatusBadge tone="neutral">{p.availability}</StatusBadge>
              </p>
            ) : null}
            {lead ? <p className="pdp-lead mt-5 max-w-prose whitespace-pre-line text-text-muted">{lead}</p> : null}

            <PurchasePanel
              productName={p.name}
              productSlug={p.slug}
              image={p.images[0]?.url ?? null}
              currency={business.currency}
              mode={p.purchaseMode}
              madeToOrder={p.kind === "made_to_order"}
              quote={quote}
              options={p.variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku, price: v.price, compare: v.compare, stock: v.stock }))}
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
            variants={p.variants.map((v) => ({ id: v.id, label: v.label }))}
            turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            submitLabel="Send enquiry"
          />
        </AskDisclosure>

        {related.length ? (
          <section aria-labelledby="related-title" className="mt-16 md:mt-24">
            <h2 id="related-title" className="font-display text-[1.75rem] leading-tight text-walnut">
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
