import type { Actor } from "@/lib/auth/permissions";
import { enableStockTracking } from "@/server/inventory";
import type { TestDb } from "./db";

export async function makeLocations(t: TestDb) {
  const rows = await t.sql`SELECT id, kind FROM locations`;
  return { showroom: rows.find((r) => r.kind === "showroom")!.id as string, workshop: rows.find((r) => r.kind === "workshop")!.id as string };
}

/** A product with one option whose stock is tracked. Returns ids needed by order/quotation tests. */
export async function makeTrackedProduct(t: TestDb, actor: Actor, sku: string, price = "1000.00") {
  const [cat] = await t.sql`INSERT INTO product_categories (name, slug) VALUES (${`Cat ${sku}`}, ${`cat-${sku.toLowerCase()}`}) RETURNING id`;
  const [p] = await t.sql`INSERT INTO products (slug, name, category_id, is_published) VALUES (${`p-${sku.toLowerCase()}`}, ${`Product ${sku}`}, ${cat!.id}, true) RETURNING id`;
  const [v] = await t.sql`INSERT INTO product_variants (product_id, sku, list_price) VALUES (${p!.id}, ${sku}, ${price}) RETURNING id`;
  const itemId = await enableStockTracking(actor, v!.id as string);
  return { productId: p!.id as string, variantId: v!.id as string, itemId };
}

export async function makeUntrackedProduct(t: TestDb, sku: string) {
  const [cat] = await t.sql`INSERT INTO product_categories (name, slug) VALUES (${`Cat ${sku}`}, ${`cat-${sku.toLowerCase()}`}) RETURNING id`;
  const [p] = await t.sql`INSERT INTO products (slug, name, category_id) VALUES (${`p-${sku.toLowerCase()}`}, ${`Product ${sku}`}, ${cat!.id}) RETURNING id`;
  const [v] = await t.sql`INSERT INTO product_variants (product_id, sku) VALUES (${p!.id}, ${sku}) RETURNING id`;
  return { variantId: v!.id as string };
}
