import { formatMoney } from "@/lib/money";

/** A price; while on sale the normal price is struck through and the sale price shown beside it. */
export function Price({ price, salePrice, currency, from = false, className }: { price: string; salePrice?: string | null; currency: string; from?: boolean; className?: string }) {
  const prefix = from ? "From " : "";
  if (!salePrice) return <span className={className}>{prefix + formatMoney(price, currency)}</span>;
  return (
    <span className={className}>
      <del className="price-was">
        <span className="sr-only">Was </span>
        {prefix + formatMoney(price, currency)}
      </del>
      <ins className="price-now">
        <span className="sr-only">Now </span>
        {formatMoney(salePrice, currency)}
      </ins>
    </span>
  );
}
