import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { productSchema, productUpdateSchema } from "@/lib/schemas/catalogue";
import { checkoutSchema } from "@/lib/schemas/orders";
import { createCategory, createProduct, updateProduct } from "@/server/catalogue";
import { getOrderPayments, recordPayment, voidPayment } from "@/server/order-money";
import { getOrder, placeOrder, setOrderStatus, updateOrderDetails } from "@/server/orders";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

const prod = (o: Record<string, unknown>) => {
  const r = productSchema.safeParse({ kind: "stocked", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};
const upd = (o: Record<string, unknown>) => {
  const r = productUpdateSchema.safeParse({ kind: "stocked", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe.skipIf(!hasTestDb)("order payments, discounts and the delivery charge rule (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, staff: Actor;
  let tableVariant: string, stoolVariant: string;
  let ip = 0;

  const stockOf = async (variantId: string) => (await t.sql`SELECT stock_quantity FROM product_variants WHERE id = ${variantId}`)[0]!.stock_quantity as number | null;

  const place = async (phone: string, lines: Array<[string, number]>, o: Record<string, unknown> = {}) => {
    const r = checkoutSchema.safeParse({ name: "Nimal Perera", phone, fulfilment: "pickup", paymentMethod: "at_showroom", consent: "on", ...o, cart: JSON.stringify(lines.map(([variantId, quantity]) => ({ variantId, quantity }))) });
    if (!r.success) throw new Error(JSON.stringify(r.error.issues));
    return placeOrder(r.data, { ip: `203.0.113.${++ip}` });
  };

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    staff = await makeActor(t, ["staff"], "Sam Staff");
    const cat = await createCategory(owner, { name: "Test Tables", slug: undefined, description: undefined, sortOrder: 0, isActive: true });
    const live = { categoryId: cat, isPublished: "on", showPrice: "on" };
    const tableId = await createProduct(owner, prod({ name: "Teak Table", sku: "TBL-1", listPrice: "100000", ...live }));
    await updateProduct(owner, tableId, upd({ name: "Teak Table", categoryId: cat, isPublished: "on", showPrice: "on" }));
    await t.sql`INSERT INTO product_variants (product_id, sku, label, list_price, sort_order) VALUES (${tableId}, 'TBL-1-DK', 'Dark finish', 110000, 1)`;
    await createProduct(owner, prod({ name: "Stool", sku: "STL-1", listPrice: "15000", ...live }));
    tableVariant = (await t.sql`SELECT id FROM product_variants WHERE sku = 'TBL-1'`)[0]!.id as string;
    stoolVariant = (await t.sql`SELECT id FROM product_variants WHERE sku = 'STL-1'`)[0]!.id as string;
    await t.sql`UPDATE product_variants SET stock_quantity = 20 WHERE id = ${stoolVariant}`;
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("marking an order paid records one payment with a receipt number, and numbers the invoice", async () => {
    const { id } = await place("0771200001", [[tableVariant, 1]]);
    expect((await getOrder(staff, id)).order).toMatchObject({ isPaid: false, paidAmount: "0.00", invoiceNumber: null });
    const r = await recordPayment(staff, id, { method: "bank_transfer", reference: "TRF-9" });
    expect(r.number).toMatch(/^RCP-\d{6}$/);
    const { order } = await getOrder(staff, id);
    expect(order).toMatchObject({ isPaid: true, paidAmount: "100000.00" });
    expect(order.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(order.paidAt).toBeInstanceOf(Date);
    const payments = await getOrderPayments(staff, id);
    expect(payments).toMatchObject([{ number: r.number, amount: "100000.00", method: "bank_transfer", reference: "TRF-9" }]);
    await expect(recordPayment(staff, id, { method: "cash" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("only the owner can void a payment, and voiding puts the order back to not paid", async () => {
    const { id } = await place("0771200002", [[tableVariant, 1]]);
    await recordPayment(staff, id, { method: "cash" });
    const [p] = await getOrderPayments(staff, id);
    await expect(voidPayment(staff, p!.id, "typo")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await voidPayment(owner, p!.id, "Entered twice");
    expect((await getOrder(staff, id)).order).toMatchObject({ isPaid: false, paidAmount: "0.00", paidAt: null });
    expect((await getOrderPayments(staff, id))[0]!.voidedAt).toBeInstanceOf(Date);
  });

  it("a cancelled order cannot be marked as paid", async () => {
    const { id } = await place("0771200003", [[stoolVariant, 1]]);
    await setOrderStatus(staff, id, "cancelled", "Changed mind");
    await expect(recordPayment(staff, id, { method: "cash" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("discounts: owner only, by amount or percent, never more than the items, and the total follows", async () => {
    const { id } = await place("0771200005", [[tableVariant, 1]]);
    await expect(updateOrderDetails(staff, id, { deliveryCharge: "0", discountAmount: "5000", discountReason: "Regular" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateOrderDetails(owner, id, { deliveryCharge: "0", discountAmount: "5000" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(updateOrderDetails(owner, id, { deliveryCharge: "0", discountAmount: "200000", discountReason: "x" })).rejects.toMatchObject({ code: "VALIDATION" });
    await updateOrderDetails(owner, id, { deliveryCharge: "0", discountPercent: "10", discountReason: "Regular customer" });
    expect((await getOrder(staff, id)).order).toMatchObject({ discount: "10000.00", discountReason: "Regular customer", subtotal: "100000.00", total: "90000.00" });
    await updateOrderDetails(staff, id, { deliveryCharge: "0", staffNote: "ok" });
    expect((await getOrder(staff, id)).order.total).toBe("90000.00");
  });

  it("a delivery order cannot be confirmed before its delivery charge is entered", async () => {
    const { id } = await place("0771200006", [[tableVariant, 1]], { fulfilment: "delivery", address: "1 Example Road", paymentMethod: "on_delivery" });
    await expect(setOrderStatus(staff, id, "confirmed")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await updateOrderDetails(staff, id, { deliveryCharge: "0" });
    await setOrderStatus(staff, id, "confirmed");
    expect((await getOrder(staff, id)).order.status).toBe("confirmed");
  });

  it("refunded status: owner only, only after delivery, puts the items back in stock, and can be undone", async () => {
    const { id } = await place("0771200009", [[stoolVariant, 2]]);
    const afterOrder = (await stockOf(stoolVariant)) ?? 0;
    await expect(setOrderStatus(owner, id, "refunded", "Faulty")).rejects.toMatchObject({ code: "INVALID_STATE" }); // not delivered yet
    await setOrderStatus(staff, id, "confirmed");
    await setOrderStatus(staff, id, "ready");
    await setOrderStatus(staff, id, "delivered");
    await recordPayment(staff, id, { method: "cash" });
    await expect(setOrderStatus(staff, id, "refunded", "Faulty")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setOrderStatus(owner, id, "refunded", "Faulty leg");
    expect((await getOrder(staff, id)).order).toMatchObject({ status: "refunded", refundReason: "Faulty leg" });
    expect((await getOrder(staff, id)).order.refundedAt).toBeInstanceOf(Date);
    expect(await stockOf(stoolVariant)).toBe(afterOrder + 2);
    await expect(updateOrderDetails(staff, id, { deliveryCharge: "0" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    await setOrderStatus(owner, id, "delivered"); // marked by mistake: undo takes the pieces out again
    expect(await stockOf(stoolVariant)).toBe(afterOrder);
    expect((await getOrder(staff, id)).order).toMatchObject({ status: "delivered", refundedAt: null, refundReason: null });
  });
});
