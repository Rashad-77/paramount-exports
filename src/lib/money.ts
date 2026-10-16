import Decimal from "decimal.js";

/**
 * Decimal arithmetic for money (2 dp) and quantities (3 dp).
 * Values cross the DB / form boundary as strings; floats are never used for
 * business arithmetic. Rounding is half-up (commercial rounding).
 */

const D = Decimal.clone({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = string | number | Decimal;

export const MONEY_DP = 2;
export const QTY_DP = 3;

/** Parse a decimal; throws on junk like "abc", "", NaN or Infinity. */
export function dec(value: DecimalInput): Decimal {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Not a finite number");
  }
  const d = new D(typeof value === "string" ? value.trim() : value);
  if (!d.isFinite()) throw new Error("Not a finite number");
  return d;
}

export function isDecimalString(value: string): boolean {
  if (!/^-?\d+(\.\d+)?$/.test(value.trim())) return false;
  return true;
}

export const round = (value: DecimalInput, dp: number): Decimal =>
  dec(value).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
export const roundMoney = (v: DecimalInput) => round(v, MONEY_DP);
export const roundQty = (v: DecimalInput) => round(v, QTY_DP);

/** Canonical string for storage in `numeric(14,2)`. */
export const moneyString = (v: DecimalInput): string =>
  roundMoney(v).toFixed(MONEY_DP);
/** Canonical string for storage in `numeric(14,3)`. */
export const qtyString = (v: DecimalInput): string =>
  roundQty(v).toFixed(QTY_DP);

export function sum(values: DecimalInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new D(0));
}

export interface LineInput {
  quantity: DecimalInput;
  unitPrice: DecimalInput;
  /** Absolute discount for the whole line (not per unit). */
  discountAmount?: DecimalInput;
}

/** quantity × unitPrice − discount, rounded once at the end. Never negative. */
export function lineTotal(line: LineInput): Decimal {
  const gross = dec(line.quantity).times(dec(line.unitPrice));
  const net = gross.minus(dec(line.discountAmount ?? 0));
  if (net.isNegative()) throw new Error("Discount exceeds line value");
  return roundMoney(net);
}

export interface DocumentTotals {
  subtotal: Decimal;
  discountTotal: Decimal;
  deliveryCharge: Decimal;
  total: Decimal;
}

/**
 * Totals for quotations/orders. `subtotal` is the sum of line gross values,
 * `discountTotal` the sum of line discounts, `total` = Σ line totals + delivery.
 */
export function documentTotals(
  lines: LineInput[],
  deliveryCharge: DecimalInput = 0,
): DocumentTotals {
  const totals = lines.map(lineTotal);
  const subtotal = roundMoney(
    sum(lines.map((l) => dec(l.quantity).times(dec(l.unitPrice)))),
  );
  const discountTotal = roundMoney(
    sum(lines.map((l) => l.discountAmount ?? 0)),
  );
  const delivery = roundMoney(deliveryCharge);
  if (delivery.isNegative())
    throw new Error("Delivery charge cannot be negative");
  return {
    subtotal,
    discountTotal,
    deliveryCharge: delivery,
    total: roundMoney(sum(totals).plus(delivery)),
  };
}

/** Outstanding = order total − Σ valid (non-voided) payments. Can be negative if overpaid. */
export function outstandingBalance(
  orderTotal: DecimalInput,
  payments: DecimalInput[],
): Decimal {
  return roundMoney(dec(orderTotal).minus(sum(payments)));
}

/** The number alone, grouped, with cents only when there are some (96,000, not 96,000.00), for tables whose column heading already names the currency. */
export function formatAmount(value: DecimalInput, locale = "en-LK"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: MONEY_DP,
  }).format(roundMoney(value).toNumber());
}

/** Display formatting only (never feed the result back into arithmetic). */
export function formatMoney(
  value: DecimalInput,
  currency: string,
  locale = "en-LK",
): string {
  const n = roundMoney(value);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: MONEY_DP,
  }).format(n.toNumber());
}
