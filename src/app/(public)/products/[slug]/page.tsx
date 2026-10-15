import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

/** A multi-line address on one line: lines joined with commas, without doubling the ones already at the end of a line. */
const oneLine = (address: string) =>
  address
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/[,\s]+$/, ""))
    .filter(Boolean)
    .join(", ");

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
  // The text under the name: the short description, or else the whole item description (which then is not repeated in the tab).
  const lead = p.shortDescription ?? p.description;
  const descriptionInTab = p.shortDescription ? p.description : null;

  const quote = { productId: p.id, name: p.name, wood: p.material, finish: p.finish, size: p.dimensions };

  // Only what applies to this piece is shown: an empty section never appears.
  const specs: Array<{ label: string; value: string }> = [
    { label: "Wood / material", value: p.material ?? "" },
    { label: "Wood treatment", value: p.woodTreatment ?? "" },
    { label: "Finish", value: p.finish ?? "" },
    { label: "Colour", value: p.colour ?? "" },
    { label: "Dimensions", value: p.dimensions ?? "" },
    { label: "Type", value: p.kind === "made_to_order" ? "Made to order" : "Ready-made" },
    ...p.otherSpecs.map((o) => ({ label: o.label || "Note", value: o.value })),
  ].filter((s) => s.value);

  const customs = CUSTOMIZATIONS.filter((c) => p.customization.includes(c));

  const tabs: ProductTab[] = [];
  if (descriptionInTab || p.features.length || p.uses.length) {
    tabs.push({
      id: "description",
      label: "Description",
      content: (
        <div className="pdp-prose">
          {descriptionInTab ? <p className="whitespace-pre-line">{descriptionInTab}</p> : null}
          {p.features.length ? (
            <>
              <h3>Features</h3>
              <List items={p.features} />
            </>
          ) : null}
          {p.uses.length ? (
            <>
              <h3>Uses</h3>
              <List items={p.uses} />
            </>
          ) : null}
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
  tabs.push({
    id: "delivery",
    label: "Delivery and care",
    content: (
      <div className="pdp-prose">
        <h3>Delivery or collection</h3>
        <p>
          We deliver to your address, and the delivery charge is agreed with you when we confirm your order. You can also collect your order from our showroom
          {business.address ? ` at ${oneLine(business.address)}` : ""}.
        </p>
        {p.leadTime ? (
          <>
            <h3>Estimated lead time</h3>
            <p>{p.leadTime}</p>
          </>
        ) : null}
        {p.careInstructions ? (
          <>
            <h3>Care instructions</h3>
            <p className="whitespace-pre-line">{p.careInstructions}</p>
          </>
        ) : null}
      </div>
    ),
  });

  return (
    <div className="pdp-page">
      {bestOff ? <p className="sale-bar">Sale · save up to {bestOff}%</p> : null}
      <div className="container-page py-8 md:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-muted">
          <ol className="flex flex-wrap gap-2">
            <li>
              <Link href="/products" className="underline">
                Collection
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={`/products?category=${p.categorySlug}`} className="underline">
                {p.categoryName}
              </Link>
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery
              images={p.images}
              name={p.name}
              saleLabel={bestOff ? `Sale · ${bestOff}% off` : undefined}
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
              leadTime={p.leadTime}
              deliveryNotes={[
                "Delivered to your address. The delivery charge is agreed with you when we confirm your order.",
                business.address ? "Or collect it free from our showroom." : "Or collect it free from the showroom.",
              ]}
              quote={quote}
              options={p.variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku, price: v.price, compare: v.compare }))}
            />
          </div>
        </div>

        <div className="mt-14 md:mt-20">
          <ProductTabs tabs={tabs} />
        </div>

        <AskDisclosure title="Have a question about this piece?" text="We reply within one working day." openLabel={prices.length ? "Ask a question" : "Enquire about this piece"}>
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
