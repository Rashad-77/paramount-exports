/** At or below this many left, a counted option shows the red "only N left" warning. */
export const LOW_STOCK_AT = 5;

export type StockState =
  | { state: "made_to_order" }
  | { state: "untracked" }
  | { state: "in"; left: number }
  | { state: "low"; left: number }
  | { state: "out" };

/** What a shopper is told about one option. `stock` is null when the business does not count it. */
export function stockState(madeToOrder: boolean, stock: number | null | undefined): StockState {
  if (madeToOrder) return { state: "made_to_order" };
  if (stock === null || stock === undefined) return { state: "untracked" };
  if (stock <= 0) return { state: "out" };
  if (stock <= LOW_STOCK_AT) return { state: "low", left: stock };
  return { state: "in", left: stock };
}
