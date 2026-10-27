import { Store, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/public/back-link";
import { AvailabilityTag } from "@/components/public/availability-tag";
import { ProductGallery } from "@/components/public/product-gallery";
import { ProductTabs, type ProductTab } from "@/components/public/product-tabs";
import { PurchasePanel } from "@/components/public/purchase-panel";
import { formatMoney } from "@/lib/money";
import { saleLabel } from "@/lib/sale";
import { specText } from "@/lib/specifications";
import type { BusinessSettings } from "@/lib/settings";
import type { getPublicProduct } from "@/server/catalogue-public";

/** A product as the product page shows it: what the public catalogue returns, or the same shape built from the product form (the preview). */
export type ProductViewData = NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>;
/** What the page needs to know about the business. */
export type ProductViewShop = Pick<BusinessSettings, "currency" | "address" | "openingHours" | "mapUrl">;

/**
 * The top of a product page: the photographs, the name, the price and buying, and the tabs (description, specifications, delivery). The product
 * page and the preview in the product form both draw it, so the preview is the page itself, only smaller. With `preview` there is no Back link and
 * no heart. `children` go under the tabs (the question box and the related pieces, which the page adds).
 */
export function ProductView({ p, shop, heart, preview = false, children }: { p: ProductViewData; shop: ProductViewShop; heart?: ReactNode; preview?: boolean; children?: ReactNode }) {
  // A product has one price line (the first), which is what is sold.
  const line = p.variants[0] ?? null;

  // A sale: the label says the amount or the percentage, as the owner entered the discount.
  const sale = saleLabel({ kind: p.discountKind, value: p.discountValue }, line?.price, line?.compare, (a) => formatMoney(a, shop.currency));

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
          <p className="whitespace-pre-line">{p.description}</p>
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
  const addressLines = (shop.address ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/[,\s]+$/, ""))
    .filter(Boolean);
  const hours = (shop.openingHours ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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
            {shop.mapUrl ? (
              <a href={shop.mapUrl} target="_blank" rel="noopener noreferrer" className="pdp-directions">
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
      <div className="container-page pb-8 pt-[calc(var(--gutter)-0.5rem)] md:pb-14">
        {preview ? null : (
          <div className="mb-3">
            <BackLink href="/products" to="the collection" tone="dark" history />
          </div>
        )}
        <div className="grid gap-10 md:grid-cols-2 md:gap-8 lg:gap-14">
          <div className="md:sticky md:top-24 md:self-start">
            <ProductGallery images={p.images} name={p.name} premium={p.isPremium} heart={heart} />
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

            {/* In the preview the buying part is shown but cannot be used (inert: no pointer, no keyboard, hidden from assistive technology). */}
            <div inert={preview}>
              <PurchasePanel
                productName={p.name}
                productSlug={p.slug}
                image={p.images[0]?.url ?? null}
                currency={shop.currency}
                madeToOrder={p.kind === "made_to_order"}
                option={line ? { id: line.id, label: line.label, sku: line.sku, price: line.price, compare: line.compare, stock: line.stock } : null}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 md:mt-20">
          <ProductTabs tabs={tabs} />
        </div>

        {children}
      </div>
    </div>
  );
}
