import { dec, moneyString, roundMoney } from "@/lib/money";

export type PaymentState = "unpaid" | "part" | "paid" | "refunded" | "part_refunded";

export interface MoneyInput {
  total: string;
  paidAmount: string;
  refundedAmount: string;
}

/**
 * The money position of an order, from its total and what has been paid and paid back.
 * A refund after the order was paid in full (a return, a goodwill credit) does not make a balance appear: nothing more is owed.
 * A refund of an order that was only part paid reduces what the customer has actually paid, so the balance grows.
 */
export function orderMoney(o: MoneyInput) {
  const total = dec(o.total);
  const paid = dec(o.paidAmount);
  const refunded = dec(o.refundedAmount);
  const net = paid.minus(refunded);
  const paidInFull = total.gt(0) && paid.gte(total);
  const balance = paidInFull ? dec(0) : roundMoney(total.minus(net)).clamp(0, Infinity);
  const overpaid = roundMoney(net.minus(total)).clamp(0, Infinity);
  const state: PaymentState = refunded.gt(0) && net.lte(0) ? "refunded" : refunded.gt(0) && paidInFull ? "part_refunded" : total.gt(0) && net.gte(total) ? "paid" : net.gt(0) ? "part" : "unpaid";
  return {
    net: moneyString(net),
    balance: moneyString(balance),
    overpaid: moneyString(overpaid),
    paidInFull,
    state,
    /** Fully paid and not fully paid back. */
    isPaid: paidInFull && net.gt(0),
  };
}
