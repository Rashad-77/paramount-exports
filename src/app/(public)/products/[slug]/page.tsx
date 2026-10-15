import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/public/add-to-cart";
import { EnquiryForm } from "@/components/public/enquiry-form";
import { ProductGallery } from "@/components/public/product-gallery";
import { StatusBadge } from "@/components/ui/status";
import { publicEnv } from "@/lib/env";
import { Price } from "@/components/public/price";
import { getBusinessSettings } from "@/lib/settings";
import { getPublicProduct } from "@/server/catalogue-public";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPublicProduct((await params).slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = p.seoDescription ?? p.description?.slice(0, 160) ?? `${p.name} — ${p.categoryName}`;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.seoTitle ?? p.name, description, type: "website", images: p.images[0] ? [{ url: p.images[0].url, alt: p.images[0].alt }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, business] = await Promise.all([getPublicProduct(slug), getBusinessSettings()]);
  if (!p) notFound();

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const prices = p.variants.map((v) => v.price).filter((x): x is string => Boolean(x));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description ?? undefined,
    sku: p.variants[0]?.sku,
    material: p.material ?? undefined,
    image: p.images.map((i) => i.url),
    url: `${site}/products/${p.slug}`,
    // Only describe an offer when the business chose to show prices publicly.
    ...(prices.length ? { offers: { "@type": "Offer", priceCurrency: business.currency, price: p.variants.find((v) => v.price)?.salePrice ?? prices[0] } } : {}),
  };

  const details: Array<[string, string]> = [
    ["Wood / material", p.material ?? ""],
    ["Finish", p.finish ?? ""],
    ["Dimensions", p.dimensions ?? ""],
    ["Type", p.kind === "made_to_order" ? "Made to order" : "Ready-made"],
  ];

  return (
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

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-10">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ProductGallery images={p.images} name={p.name} productId={p.id} onSale={p.variants.some((v) => v.salePrice)} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{p.categoryName}</p>
          <h1 className="font-display mt-3 text-headline text-walnut">{p.name}</h1>
          {p.availability ? (
            <p className="mt-4">
              <StatusBadge tone="neutral">{p.availability}</StatusBadge>
            </p>
          ) : null}
          {p.description ? <p className="mt-6 max-w-prose whitespace-pre-line text-text-muted">{p.description}</p> : null}

          <dl className="mt-8 divide-y divide-border border-y border-border text-sm">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-3">
                  <dt className="text-text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            <div className="grid grid-cols-[9rem_1fr] gap-4 py-3">
              <dt className="text-text-muted">{p.variants.length > 1 ? "Options" : "Code"}</dt>
              <dd>
                <ul className="space-y-1">
                  {p.variants.map((v) => (
                    <li key={v.id}>
                      {p.variants.length > 1 ? `${v.label} · ` : ""}
                      <span className="tabular">{v.sku}</span>
                      {v.price ? (
                        <>
                          {" · "}
                          <Price price={v.price} salePrice={v.salePrice} currency={business.currency} />
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          <AddToCart
            productName={p.name}
            productSlug={p.slug}
            image={p.images[0]?.url ?? null}
            currency={business.currency}
            options={p.variants.map((v) => ({ id: v.id, label: v.label, sku: v.sku, price: v.price }))}
          />

          <section id="enquire" aria-labelledby="enquire-title" className="mt-7 scroll-mt-6 border border-border bg-surface p-6">
            <h2 id="enquire-title" className="font-display text-[1.5rem] leading-tight text-walnut">
              {prices.length ? "Ask about this piece" : "Enquire about this piece"}
            </h2>
            <p className="mt-1 mb-5 text-sm text-text-muted">Tell us how to reach you and we will get back to you about {p.name}.</p>
            <EnquiryForm
              kind="product_enquiry"
              productId={p.id}
              variants={p.variants.map((v) => ({ id: v.id, label: v.label }))}
              turnstileSiteKey={publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              submitLabel="Send enquiry"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
