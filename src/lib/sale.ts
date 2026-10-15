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
