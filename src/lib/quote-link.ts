/** Plain helpers for the "Request a quote" link. No client or server code, so pages and client components can both use them. */

export interface QuoteDetails {
  productId: string;
  name: string;
  wood?: string | null;
  finish?: string | null;
  size?: string | null;
}

/** The link to the quotation form with this product's details filled in. */
export function quoteHref(q: QuoteDetails, optionLabel?: string | null): string {
  const p = new URLSearchParams({ product: q.productId, item: optionLabel && optionLabel !== "Standard" ? `${q.name} (${optionLabel})` : q.name });
  if (q.wood) p.set("wood", q.wood);
  if (q.finish) p.set("finish", q.finish);
  if (q.size) p.set("size", q.size);
  return `/custom?${p.toString()}#quotation`;
}
