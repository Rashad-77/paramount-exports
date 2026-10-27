"use client";

import { useEffect, useRef, useState } from "react";
import { ProductView, type ProductViewData, type ProductViewShop } from "@/components/public/product-view";
import { priceAfterDiscount } from "@/lib/sale";
import { AVAILABILITY_LABEL } from "@/lib/schemas/catalogue";
import type { SpecEntry } from "@/lib/specifications";

/** What the form holds, as the preview reads it. */
export interface PreviewInput {
  name: string;
  /** The category as the form lists it ("Furniture › Tables"); the page shows only its own name. */
  category: string;
  shortDescription: string;
  description: string;
  premium: boolean;
  availability: string;
  stock: string;
  price: string;
  discountKind: string;
  discountValue: string;
  kind: string;
  specEntries: SpecEntry[];
  photos: Array<{ key: string; url: string; x: number; y: number; z: number }>;
}

/** The product the form describes, in the shape the product page draws. What a visitor would see is worked out the same way the page's data is: a price only when one is entered, and so on. */
function toProductView(i: PreviewInput): ProductViewData {
  const now = priceAfterDiscount(i.price, i.discountKind, i.discountValue);
  const stateKey = i.availability === "on_request" ? "made_to_order" : i.availability;
  const state = stateKey === "in_stock" || stateKey === "made_to_order" || stateKey === "sold" ? stateKey : null;
  const made = i.kind === "made_to_order";
  const stock = i.availability === "in_stock" && i.stock !== "" && Number.isFinite(Number(i.stock)) ? Number(i.stock) : null;
  return {
    id: "preview",
    slug: "preview",
    name: i.name,
    description: i.description || null,
    material: null,
    finish: null,
    dimensions: null,
    kind: made ? "made_to_order" : "stocked",
    categoryId: "",
    shortDescription: i.shortDescription || null,
    specifications: i.specEntries,
    discountKind: now ? (i.discountKind as "amount" | "percent") : null,
    discountValue: now ? i.discountValue : null,
    isPremium: i.premium,
    priceShown: Boolean(i.price),
    categoryName: i.category.split("›").pop()?.trim() ?? "",
    categorySlug: "",
    seoTitle: null,
    seoDescription: null,
    availability: state ? AVAILABILITY_LABEL[state] : null,
    availabilityState: state,
    images: i.photos.map((p, n) => ({ id: p.key || String(n), alt: i.name, x: p.x, y: p.y, z: p.z, url: p.url })),
    variants: [{ id: "preview", sku: "", label: "", price: i.price ? (now ?? i.price) : null, compare: i.price && now ? i.price : null, stock }],
    updatedAt: new Date(),
  } as ProductViewData;
}

/**
 * The page's content on a computer screen is 1072 px wide (the site's 72 rem page, less its 40 px side margins). The preview draws exactly that, with only a
 * 16 px margin each side, and shrinks it to the box, so it fills the box and every size inside keeps its proportion to the others. The page width and the
 * side margin are set here, whatever the dashboard sets, so the preview is the same everywhere.
 */
const SIDE = 16;
const PAGE_WIDTH = 1072 + 2 * SIDE;

/**
 * The product page as it will look, only smaller: the page itself is drawn at its full width and shrunk to fit the box, so every size and every gap keeps
 * the proportions it has on the website. A page longer than the box scrolls inside it. The tabs (Description, Specifications, Delivery and collection) and the
 * photograph frames work; the buying part and the links do not.
 */
export function ProductPagePreview({ input, shop }: { input: PreviewInput; shop: ProductViewShop }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_WIDTH));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="max-h-[65vh] overflow-y-auto overflow-x-hidden border border-border">
      <div style={{ zoom: scale, width: PAGE_WIDTH, ["--head-h" as string]: "0px", ["--content-width" as string]: `${PAGE_WIDTH}px`, ["--gutter" as string]: `${SIDE}px` }} className="page-body pdp-preview [&_.pdp-page]:min-h-0 [&_a]:pointer-events-none">
        <ProductView p={toProductView(input)} shop={shop} preview />
      </div>
    </div>
  );
}
