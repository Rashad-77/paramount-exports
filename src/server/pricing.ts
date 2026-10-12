import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { can, type Actor } from "@/lib/auth/permissions";
import type { DbOrTx } from "@/lib/db/client";
import { productVariants, products } from "@/lib/db/schema";
import { validation } from "@/lib/errors";
import { dec, documentTotals, lineTotal, moneyString } from "@/lib/money";
import type { QuotationItemInput } from "@/lib/schemas/quotation";
import { getSalesSettings } from "./settings";

export type Computed = {
  lines: Array<{ item: QuotationItemInput; lineTotal: string }>;
  totals: { subtotal: string; discountTotal: string; deliveryCharge: string; total: string };
};

export interface PricedInput {
  deliveryCharge: string;
  items: QuotationItemInput[];
}

/**
 * Shared by quotations and orders so both obey identical rules.
 * All money maths happens here, in decimals, from the submitted quantities and prices. Totals sent by a client are
 * never read. Sales staff are held to the configured discount limit; Managers/Owners can override it.
 */
export async function computeAndCheck(db: DbOrTx, actor: Actor, input: PricedInput): Promise<Computed> {
  if (input.items.length === 0) throw validation("Add at least one item.", { itemsJson: ["Add at least one item."] });
  const maxPct = dec((await getSalesSettings(db)).maxDiscountPercent);
  const canOverride = can(actor, "quotations:discount_override");

  const variantIds = [...new Set(input.items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))];
  if (variantIds.length) {
    const found = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(inArray(productVariants.id, variantIds), eq(productVariants.isActive, true), sql`${products.archivedAt} IS NULL`));
    if (found.length !== variantIds.length) throw validation("One of the products is no longer available. Choose another or enter it as a custom item.", { itemsJson: ["A product on this document is no longer available."] });
  }

  const lines: Computed["lines"] = [];
  const errors: string[] = [];
  input.items.forEach((item, i) => {
    const gross = dec(item.quantity).times(dec(item.unitPrice));
    const disc = dec(item.discountAmount);
    if (disc.gt(gross)) {
      errors.push(`Item ${i + 1}: the discount is larger than the item's value.`);
      return;
    }
    if (disc.gt(0) && !canOverride) {
      const pct = gross.isZero() ? dec(100) : disc.div(gross).times(100);
      if (pct.gt(maxPct)) errors.push(`Item ${i + 1}: a discount of ${pct.toDecimalPlaces(1).toString()}% is above your limit of ${maxPct.toString()}%. A manager can approve larger discounts.`);
    }
    lines.push({ item, lineTotal: moneyString(lineTotal({ quantity: item.quantity, unitPrice: item.unitPrice, discountAmount: item.discountAmount })) });
  });
  if (errors.length) throw validation(errors[0]!, { itemsJson: errors });

  const t = documentTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount })),
    input.deliveryCharge,
  );
  return { lines, totals: { subtotal: t.subtotal.toFixed(2), discountTotal: t.discountTotal.toFixed(2), deliveryCharge: t.deliveryCharge.toFixed(2), total: t.total.toFixed(2) } };
}

/** Custom-piece specification stored as JSON (dimensions / material / finish / notes), or null when empty. */
export function specification(i: Pick<QuotationItemInput, "dimensions" | "material" | "finish" | "notes">) {
  const s = Object.fromEntries(Object.entries({ dimensions: i.dimensions, material: i.material, finish: i.finish, notes: i.notes }).filter(([, v]) => v));
  return Object.keys(s).length ? s : null;
}
