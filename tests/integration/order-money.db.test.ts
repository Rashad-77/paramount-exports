import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { productSchema, productUpdateSchema } from "@/lib/schemas/catalogue";
import { checkoutSchema } from "@/lib/schemas/orders";
import { addVariant, createCategory, createProduct, updateProduct } from "@/server/catalogue";
import { createCase, getOrderExtras, recordPayment, recordRefund, resolveCase, updateOrderItems, voidPayment } from "@/server/order-money";
import { getOrder, placeOrder, setOrderStatus, updateOrderDetails } from "@/server/orders";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

const prod = (o: Record<string, unknown>) => {
  const r = productSchema.safeParse({ kind: "stocked", purchaseMode: "direct", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};
const upd = (o: Record<string, unknown>) => {
  const r = productUpdateSchema.safeParse({ kind: "stocked", purchaseMode: "direct", ...o });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe.skipIf(!hasTestDb)("order money, items and after-sales (real Postgres)", () => {
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
    await addVariant(owner, tableId, { sku: "TBL-1-DK", label: "Dark finish", listPrice: "110000", isActive: true });
    await createProduct(owner, prod({ name: "Stool", sku: "STL-1", listPrice: "15000", ...live }));
    tableVariant = (await t.sql`SELECT id FROM product_variants WHERE sku = 'TBL-1'`)[0]!.id as string;
    stoolVariant = (await t.sql`SELECT id FROM product_variants WHERE sku = 'STL-1'`)[0]!.id as string;
    await t.sql`UPDATE product_variants SET stock_quantity = 20 WHERE id = ${stoolVariant}`;
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("takes part payments, numbers each receipt, and is paid only when the balance is settled", async () => {
    const { id } = await place("0771200001", [[tableVariant, 1]]);
    expect((await recordPayment(staff, id, { amount: "30000", method: "cash" })).isPaid).toBe(false);
    let { order } = await getOrder(staff, id);
    expect(order).toMatchObject({ isPaid: false, paidAmount: "30000.00" });
    expect(order.invoiceNumber).toMatch(/^INV-\d{6}$/);
    await expect(recordPayment(staff, id, { amount: "80000", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await recordPayment(staff, id, { amount: "70000", method: "bank_transfer", reference: "TRF-9" })).isPaid).toBe(true);
    ({ order } = await getOrder(staff, id));
    expect(order).toMatchObject({ isPaid: true, paidAmount: "100000.00" });
    expect(order.paidAt).toBeInstanceOf(Date);
    const { payments } = await getOrderExtras(staff, id);
    expect(payments.map((p) => p.number)).toEqual([expect.stringMatching(/^RCP-\d{6}$/), expect.stringMatching(/^RCP-\d{6}$/)]);
    expect(new Set(payments.map((p) => p.number)).size).toBe(2);
    await expect(recordPayment(staff, id, { amount: "1", method: "cash" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("only the owner can void a payment, and voiding puts the money back to due", async () => {
    const { id } = await place("0771200002", [[tableVariant, 1]]);
    await recordPayment(staff, id, { amount: "100000", method: "cash" });
    const [p] = (await getOrderExtras(staff, id)).payments;
    await expect(voidPayment(staff, p!.id, "typo")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await voidPayment(owner, p!.id, "Entered twice");
    expect((await getOrder(staff, id)).order).toMatchObject({ isPaid: false, paidAmount: "0.00", paidAt: null });
    expect((await getOrderExtras(staff, id)).payments[0]!.voidedAt).toBeInstanceOf(Date);
  });

  it("refunds: owner only, never more than was paid, numbered as a credit note, and returned items go back in stock", async () => {
    const { id } = await place("0771200003", [[stoolVariant, 3]]);
    const stockAfterOrder = await stockOf(stoolVariant);
    await recordPayment(staff, id, { amount: "45000", method: "cash" });
    const items = (await getOrder(staff, id)).items;
    await expect(recordRefund(staff, id, { amount: "15000", method: "cash", reason: "Returned", returns: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(recordRefund(owner, id, { amount: "50000", method: "cash", reason: "Too much", returns: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(recordRefund(owner, id, { amount: "15000", method: "cash", reason: "Too many", returns: [{ itemId: items[0]!.id, quantity: 4 }] })).rejects.toMatchObject({ code: "VALIDATION" });
    const r = await recordRefund(owner, id, { amount: "15000", method: "cash", reason: "One stool came back", returns: [{ itemId: items[0]!.id, quantity: 1 }] });
    expect(r.number).toMatch(/^CRN-\d{6}$/);
    expect(await stockOf(stoolVariant)).toBe((stockAfterOrder ?? 0) + 1);
    const { order, items: after } = await getOrder(staff, id);
    expect(order).toMatchObject({ refundedAmount: "15000.00", isPaid: true });
    expect(after[0]!.returnedQuantity).toBe(1);
  });

  it("cancelling an order with returned pieces puts back only the rest", async () => {
    const { id } = await place("0771200004", [[stoolVariant, 2]]);
    const before = await stockOf(stoolVariant);
    await recordPayment(staff, id, { amount: "30000", method: "cash" });
    const line = (await getOrder(staff, id)).items[0]!;
    await recordRefund(owner, id, { amount: "15000", method: "cash", reason: "One back", returns: [{ itemId: line.id, quantity: 1 }] });
    expect(await stockOf(stoolVariant)).toBe((before ?? 0) + 1);
    await setOrderStatus(staff, id, "cancelled", "Changed mind");
    expect(await stockOf(stoolVariant)).toBe((before ?? 0) + 2);
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

  it("editing items: quantities, additions and removals move the stock and the total; a finished order is refused", async () => {
    const { id } = await place("0771200007", [[stoolVariant, 2]]);
    const before = await stockOf(stoolVariant);
    const line = (await getOrder(staff, id)).items[0]!;
    await updateOrderItems(staff, id, { changes: [{ itemId: line.id, quantity: 4 }], add: [{ variantId: tableVariant, quantity: 1 }] });
    let { order, items } = await getOrder(staff, id);
    expect(items.map((i) => [i.productName, i.quantity])).toEqual([["Stool", 4], ["Teak Table", 1]]);
    expect(order).toMatchObject({ subtotal: "160000.00", total: "160000.00" });
    expect(await stockOf(stoolVariant)).toBe((before ?? 0) - 2);
    await updateOrderItems(staff, id, { changes: [{ itemId: line.id, quantity: 0 }], add: [] });
    ({ order, items } = await getOrder(staff, id));
    expect(items).toHaveLength(1);
    expect(order.total).toBe("100000.00");
    expect(await stockOf(stoolVariant)).toBe((before ?? 0) + 2);
    await expect(updateOrderItems(staff, id, { changes: [{ itemId: items[0]!.id, quantity: 0 }], add: [] })).rejects.toMatchObject({ code: "VALIDATION" });
    await setOrderStatus(staff, id, "confirmed");
    await setOrderStatus(staff, id, "ready");
    await setOrderStatus(staff, id, "delivered");
    await expect(updateOrderItems(staff, id, { changes: [], add: [{ variantId: stoolVariant, quantity: 1 }] })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("the after-sales log: open, resolve, reopen, and every step is in the history with who did it", async () => {
    const { id } = await place("0771200008", [[tableVariant, 1]]);
    await createCase(staff, id, { kind: "warranty", title: "Drawer sticks", details: "Left drawer" });
    let { cases } = await getOrderExtras(staff, id);
    expect(cases).toMatchObject([{ title: "Drawer sticks", kind: "warranty", status: "open" }]);
    await resolveCase(staff, cases[0]!.id, "Re-planed the runner", false);
    ({ cases } = await getOrderExtras(staff, id));
    expect(cases[0]).toMatchObject({ status: "resolved", resolution: "Re-planed the runner" });
    await resolveCase(staff, cases[0]!.id, undefined, true);
    expect((await getOrderExtras(staff, id)).cases[0]!.status).toBe("open");
    const { history } = await getOrderExtras(staff, id);
    expect(history.map((h) => h.action)).toEqual(["order.placed_from_website", "order.case_opened", "order.case_resolved", "order.case_reopened"]);
    expect(history[1]!.by).toBe("Sam Staff");
  });
});
