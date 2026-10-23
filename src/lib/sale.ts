import Decimal from "decimal.js";

/** Whole-number percentage off, e.g. 20 for a price that fell from 100 to 80. Null when there is no sale. */
export function percentOff(price: string | null | undefined, compare: string | null | undefined): number | null {
  if (!price || !compare) return null;
  try {
    const p = new Decimal(price);
    const c = new Decimal(compare);
    if (c.lte(p) || c.lte(0)) return null;
    const pct = c.minus(p).div(c).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    return pct >= 1 ? pct : null;
  } catch {
    return null;
  }
}

export interface Discount {
  kind: "amount" | "percent" | null;
  value: string | null;
}

/**
 * The words on a sale label. A discount entered as money says the amount ("Sale · LKR 5,000 off"); one entered as a percentage says the
 * percentage ("Sale · 20% off"). A sale with no recorded discount (an older price line) falls back to the percentage worked out from the two prices.
 */
export function saleLabel(d: Discount, price: string | null | undefined, compare: string | null | undefined, format: (amount: string) => string): string | null {
  if (!price || !compare) return null;
  if (d.kind === "amount" && d.value) return `Sale · ${format(d.value)} off`;
  if (d.kind === "percent" && d.value) return `Sale · ${Number(d.value)}% off`;
  const pct = percentOff(price, compare);
  return pct ? `Sale · ${pct}% off` : null;
}

/** The price after a discount: money off, or a percentage off, rounded to two places. Null when there is nothing valid to take off. */
export function priceAfterDiscount(regular: string | null | undefined, kind: string | null | undefined, value: string | null | undefined): string | null {
  if (!regular || !value || (kind !== "amount" && kind !== "percent")) return null;
  try {
    const r = new Decimal(regular);
    const v = new Decimal(value);
    if (r.lte(0) || v.lte(0)) return null;
    const after = kind === "percent" ? r.times(new Decimal(100).minus(v)).div(100) : r.minus(v);
    return after.gt(0) ? after.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) : null;
  } catch {
    return null;
  }
}
