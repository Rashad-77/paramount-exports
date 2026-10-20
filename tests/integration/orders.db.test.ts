import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { productSchema, productUpdateSchema } from "@/lib/schemas/catalogue";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { checkoutSchema } from "@/lib/schemas/orders";
import { addVariant, createCategory, createProduct, updateProduct } from "@/server/catalogue";
import { getMessage, listMessages, setMessageHandled, submitEnquiry } from "@/server/messages";
import { trackSchema } from "@/lib/schemas/tracking";
import { trackOrder } from "@/server/tracking";
import { countOrdersByStatus, getCustomer, getDashboard, getOrder, listCustomers, listOrders, placeOrder, setOrderPaid, setOrderStatus, updateOrderDetails } from "@/server/orders";
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

describe.skipIf(!hasTestDb)("online orders (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, staff: Actor, nobody: Actor;
  let tableId: string, stoolId: string, hiddenId: string, unpricedId: string;
  let tableVariant: string, darkVariant: string, stoolVariant: string, hiddenVariant: string, unpricedVariant: string;
  let ip = 0;

  const variantOf = async (sku: string) => (await t.sql`SELECT id FROM product_variants WHERE sku = ${sku}`)[0]!.id as string;
  const checkout = (o: Record<string, unknown>, lines: [string, number][]) => {
    const r = checkoutSchema.safeParse({
      name: "Nimal Perera",
      phone: "0771110001",
      fulfilment: "delivery",
      address: "12 Example Road, Colombo",
      paymentMethod: "on_delivery",
      consent: "on",
      ...o,
      cart: JSON.stringify(lines.map(([variantId, quantity]) => ({ variantId, quantity }))),
    });
    if (!r.success) throw new Error(JSON.stringify(r.error.issues));
    return r.data;
  };
  const place = (o: Record<string, unknown>, lines: [string, number][]) => placeOrder(checkout(o, lines), { ip: `203.0.113.${++ip}` });

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    staff = await makeActor(t, ["staff"], "Sam Staff");
    nobody = await makeActor(t, [], "No Role");
    const cat = await createCategory(owner, { name: "Test Tables", slug: undefined, description: undefined, sortOrder: 0, isActive: true });
    const live = { categoryId: cat, isPublished: "on", showPrice: "on" };
    tableId = await createProduct(owner, prod({ name: "Teak Table", sku: "TBL-1", listPrice: "100000", ...live }));
    await updateProduct(owner, tableId, upd({ name: "Teak Table", categoryId: cat, isPublished: "on", showPrice: "on" }));
    await addVariant(owner, tableId, { sku: "TBL-1-DK", label: "Dark finish", listPrice: "110000", isActive: true });
    stoolId = await createProduct(owner, prod({ name: "Stool", sku: "STL-1", listPrice: "15000.50", ...live }));
    hiddenId = await createProduct(owner, prod({ name: "Hidden Chair", sku: "HID-1", listPrice: "20000", categoryId: cat, showPrice: "on" })); // not published
    unpricedId = await createProduct(owner, prod({ name: "Unpriced Bench", sku: "UNP-1", categoryId: cat, isPublished: "on" })); // no price
    [tableVariant, darkVariant, stoolVariant, hiddenVariant, unpricedVariant] = (await Promise.all(["TBL-1", "TBL-1-DK", "STL-1", "HID-1", "UNP-1"].map(variantOf))) as [string, string, string, string, string];
    void [tableId, stoolId, hiddenId, unpricedId];
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("places an order priced from the database, with a reference, nothing paid and no delivery charge yet", async () => {
    const { id, reference } = await place({}, [[tableVariant, 2], [stoolVariant, 3]]);
    expect(reference).toMatch(/^[1-9]\d{8}$/);
    const { order, items } = await getOrder(staff, id);
    expect(order).toMatchObject({ status: "new", isPaid: false, fulfilment: "delivery", paymentMethod: "on_delivery", subtotal: "245001.50", deliveryCharge: "0.00", total: "245001.50", phoneKey: "771110001" });
    expect(items.map((i) => [i.productName, i.quantity, i.unitPrice, i.lineTotal])).toEqual([
      ["Teak Table", 2, "100000.00", "200000.00"],
      ["Stool", 3, "15000.50", "45001.50"],
    ]);
    const [log] = await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${id}`;
    expect(log!.action).toBe("order.placed_from_website");
  });

  it("merges repeated lines and keeps each option's own price", async () => {
    const { id } = await place({ phone: "0771110002" }, [[tableVariant, 1], [darkVariant, 1], [tableVariant, 1]]);
    const { items, order } = await getOrder(owner, id);
    expect(items.map((i) => [i.variantLabel, i.quantity])).toEqual([[null, 2], ["Dark finish", 1]]);
    expect(order.total).toBe("310000.00");
  });

  it("refuses items that are hidden, unpriced or unknown, and never trusts a price from the browser", async () => {
    await expect(place({ phone: "0771110003" }, [[hiddenVariant, 1]])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(place({ phone: "0771110003" }, [[unpricedVariant, 1]])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(place({ phone: "0771110003" }, [["00000000-0000-4000-8000-0000000000aa", 1]])).rejects.toMatchObject({ code: "VALIDATION" });
    // the checkout schema only accepts ids and quantities
    const parsed = checkoutSchema.safeParse({ name: "A", phone: "0771110003", fulfilment: "pickup", paymentMethod: "at_showroom", consent: "on", cart: JSON.stringify([{ variantId: tableVariant, quantity: 1, price: "1.00" }]) });
    expect(parsed.success && Object.keys(parsed.data.cart[0]!)).toEqual(["variantId", "quantity"]);
  });

  it("validates the checkout: address for delivery, sensible payment choices, consent, quantities", () => {
    const base = { name: "A B", phone: "0771110009", consent: "on", cart: JSON.stringify([{ variantId: tableVariant, quantity: 1 }]) };
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery", paymentMethod: "on_delivery" }).success).toBe(false); // no address
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery", address: "1 Road", paymentMethod: "at_showroom" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "pickup", paymentMethod: "on_delivery" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "pickup", paymentMethod: "at_showroom" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "pickup", paymentMethod: "bank_transfer", consent: undefined }).success).toBe(false);
    for (const bad of ["[]", "not json", JSON.stringify([{ variantId: tableVariant, quantity: 0 }]), JSON.stringify([{ variantId: tableVariant, quantity: 100 }])]) {
      expect(checkoutSchema.safeParse({ ...base, fulfilment: "pickup", paymentMethod: "at_showroom", cart: bad }).success, bad).toBe(false);
    }
  });

  it("a placed order keeps its prices and names when the catalogue changes later", async () => {
    const { id } = await place({ phone: "0771110004", fulfilment: "pickup", paymentMethod: "at_showroom", address: undefined }, [[stoolVariant, 1]]);
    await t.sql`UPDATE product_variants SET list_price = 99999 WHERE id = ${stoolVariant}`;
    await t.sql`UPDATE products SET name = 'Renamed Stool' WHERE id = ${stoolId}`;
    const { order, items } = await getOrder(staff, id);
    expect(order.total).toBe("15000.50");
    expect(items[0]).toMatchObject({ productName: "Stool", unitPrice: "15000.50" });
    expect(order.address).toBeNull();
    await t.sql`UPDATE product_variants SET list_price = 15000.50 WHERE id = ${stoolVariant}`;
    await t.sql`UPDATE products SET name = 'Stool' WHERE id = ${stoolId}`;
  });

  it("limits how many orders one phone number or address can place", async () => {
    for (let i = 0; i < 5; i++) await placeOrder(checkout({ phone: "0771119999" }, [[stoolVariant, 1]]), { ip: `198.51.100.${i}` });
    await expect(placeOrder(checkout({ phone: "0771119999" }, [[stoolVariant, 1]]), { ip: "198.51.100.77" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    for (let i = 0; i < 6; i++) await placeOrder(checkout({ phone: `07712000${i}0` }, [[stoolVariant, 1]]), { ip: "192.0.2.50" }).catch(() => undefined);
    await expect(placeOrder(checkout({ phone: "0771299999" }, [[stoolVariant, 1]]), { ip: "192.0.2.50" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("moves an order through its statuses and refuses impossible moves", async () => {
    const { id } = await place({ phone: "0771110005" }, [[tableVariant, 1]]);
    await expect(setOrderStatus(staff, id, "delivered")).rejects.toMatchObject({ code: "INVALID_STATE" }); // new → delivered is not allowed
    await setOrderStatus(staff, id, "confirmed");
    await expect(setOrderStatus(staff, id, "delivered")).rejects.toMatchObject({ code: "INVALID_STATE" }); // confirmed → delivered skips the making and the ready step
    await setOrderStatus(staff, id, "in_progress");
    await setOrderStatus(staff, id, "ready");
    await setOrderStatus(staff, id, "delivered");
    const { order } = await getOrder(staff, id);
    expect(order.status).toBe("delivered");
    expect(order.confirmedAt).toBeInstanceOf(Date);
    expect(order.deliveredAt).toBeInstanceOf(Date);
    await expect(setOrderStatus(staff, id, "cancelled", "too late")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(setOrderStatus(staff, id, "confirmed")).rejects.toMatchObject({ code: "INVALID_STATE" });
    const actions = (await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${id} ORDER BY created_at`).map((r) => r.action);
    expect(actions).toEqual(["order.placed_from_website", "order.confirmed", "order.in_progress", "order.ready", "order.delivered"]);
  });

  it("cancelling needs a reason and cannot be undone", async () => {
    const { id } = await place({ phone: "0771110006" }, [[tableVariant, 1]]);
    await setOrderStatus(staff, id, "cancelled", "Customer changed their mind");
    const { order } = await getOrder(staff, id);
    expect(order).toMatchObject({ status: "cancelled", cancelReason: "Customer changed their mind" });
    await expect(setOrderStatus(staff, id, "confirmed")).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(setOrderPaid(staff, id, true)).rejects.toMatchObject({ code: "INVALID_STATE" });
    // the database itself refuses a cancelled order with no reason
    await expect(t.sql`UPDATE online_orders SET status = 'cancelled', cancel_reason = NULL WHERE id = ${(await place({ phone: "0771110007" }, [[stoolVariant, 1]])).id}`).rejects.toThrow();
  });

  it("recalculates the total when staff agree a delivery charge, and records payment once, with an audit trail", async () => {
    const { id } = await place({ phone: "0771110008" }, [[tableVariant, 1]]);
    await updateOrderDetails(staff, id, { deliveryCharge: "7500", staffNote: "Call after 5pm" });
    let { order } = await getOrder(staff, id);
    expect(order).toMatchObject({ deliveryCharge: "7500.00", total: "107500.00", subtotal: "100000.00", staffNote: "Call after 5pm" });
    await setOrderPaid(staff, id, true);
    ({ order } = await getOrder(staff, id));
    expect(order.isPaid).toBe(true);
    expect(order.paidAt).toBeInstanceOf(Date);
    await expect(setOrderPaid(staff, id, true)).rejects.toMatchObject({ code: "CONFLICT" });
    await setOrderPaid(staff, id, false);
    expect((await getOrder(staff, id)).order).toMatchObject({ isPaid: false, paidAt: null });
    const actions = (await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${id} ORDER BY created_at`).map((r) => r.action);
    expect(actions).toEqual(["order.placed_from_website", "order.details_updated", "order.marked_paid", "order.marked_unpaid"]);
  });

  it("a finished order cannot be edited", async () => {
    const { id } = await place({ phone: "0771110011" }, [[tableVariant, 1]]);
    await setOrderStatus(staff, id, "confirmed");
    await setOrderStatus(staff, id, "ready");
    await setOrderStatus(staff, id, "delivered");
    await expect(updateOrderDetails(staff, id, { deliveryCharge: "100" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("only staff and owners can see or change orders", async () => {
    const { id } = await place({ phone: "0771110012" }, [[tableVariant, 1]]);
    for (const fn of [
      () => listOrders(nobody, { page: 1, pageSize: 10 }),
      () => getOrder(nobody, id),
      () => setOrderStatus(nobody, id, "confirmed"),
      () => setOrderPaid(nobody, id, true),
      () => updateOrderDetails(nobody, id, { deliveryCharge: "1" }),
      () => listCustomers(nobody, { page: 1, pageSize: 10 }),
      () => getDashboard(nobody),
      () => countOrdersByStatus(nobody),
    ]) {
      await expect(fn()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(listOrders(staff, { page: 1, pageSize: 10 })).resolves.toBeTruthy();
    await expect(listOrders(owner, { page: 1, pageSize: 10 })).resolves.toBeTruthy();
  });

  it("filters and searches orders, and counts them by status", async () => {
    const all = await listOrders(staff, { page: 1, pageSize: 100 });
    expect(all.total).toBeGreaterThan(8);
    const found = await listOrders(staff, { q: "0771110001", page: 1, pageSize: 10 });
    expect(found.rows.every((r) => r.phone === "0771110001")).toBe(true);
    const byRef = await listOrders(staff, { q: all.rows[0]!.reference.toLowerCase(), page: 1, pageSize: 10 });
    expect(byRef.rows.map((r) => r.id)).toContain(all.rows[0]!.id);
    const cancelled = await listOrders(staff, { status: "cancelled", page: 1, pageSize: 10 });
    expect(cancelled.rows.every((r) => r.status === "cancelled")).toBe(true);
    const counts = await countOrdersByStatus(staff);
    expect(counts.all).toBe(all.total);
    expect(counts.new + counts.confirmed + counts.in_progress + counts.delivered + counts.cancelled).toBe(counts.all);
    // a search made of LIKE wildcards matches nothing instead of everything
    expect((await listOrders(staff, { q: "%", page: 1, pageSize: 10 })).total).toBe(0);
  });

  it("builds a customer list from orders, grouped by phone number", async () => {
    await place({ phone: "+94 77 111 0001", name: "N. Perera" }, [[stoolVariant, 1]]);
    const list = await listCustomers(staff, { page: 1, pageSize: 50 });
    const nimal = list.rows.find((c) => c.phoneKey === "771110001")!;
    expect(nimal.orderRefs.length).toBeGreaterThanOrEqual(2);
    expect(nimal.name).toBe("N. Perera"); // the most recent order's name
    const detail = await getCustomer(staff, "771110001");
    expect(detail.orders.length).toBe(nimal.orderRefs.length);
    await expect(getCustomer(staff, "000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await listCustomers(staff, { q: "perera", page: 1, pageSize: 50 })).rows.length).toBeGreaterThan(0);
  });

  it("summarises the dashboard", async () => {
    const d = await getDashboard(owner);
    expect(d.counts.all).toBeGreaterThan(8);
    expect(d.daily).toHaveLength(30);
    expect(d.last30.orders).toBeGreaterThan(0);
    expect(d.recent.length).toBeLessThanOrEqual(6);
  });
  describe("order tracking", () => {
    const track = (reference: string, phone: string, ip = "198.51.100.1") => {
      const r = trackSchema.safeParse({ reference, phone });
      if (!r.success) throw new Error(JSON.stringify(r.error.issues));
      return trackOrder(r.data, { ip });
    };

    it("shows a customer their own order, and nothing private", async () => {
      const { id, reference } = await place({ name: "Kamal Silva", phone: "0771119001", address: "99 Secret Lane, Kandy" }, [[stoolVariant, 2]]);
      const seen = await track(reference.toLowerCase(), "+94 77 111 9001", "198.51.100.10");
      expect(seen).toMatchObject({ reference, status: "new", firstName: "Kamal", fulfilment: "delivery", paymentMethod: "on_delivery", isPaid: false, subtotal: "30001.00", total: "30001.00" });
      expect(seen.items).toEqual([{ name: "Stool", label: null, quantity: 2, lineTotal: "30001.00", imageUrl: null, imageAlt: "Stool" }]);
      // no address, phone, email or staff notes ever leave the server
      const text = JSON.stringify(seen);
      expect(text).not.toMatch(/Secret Lane|771119001|staffNote|customerNote|email/i);
      expect(Object.keys(seen)).not.toContain("address");

      await setOrderStatus(staff, id, "confirmed");
      await updateOrderDetails(staff, id, { deliveryCharge: "1500", staffNote: "internal remark" });
      await setOrderPaid(staff, id, true);
      const later = await track(reference, "0771119001", "198.51.100.10");
      expect(later).toMatchObject({ status: "confirmed", deliveryCharge: "1500.00", total: "31501.00", isPaid: true });
      expect(later.confirmedAt).not.toBeNull();
      expect(JSON.stringify(later)).not.toMatch(/internal remark/);
    });

    it("says so plainly for an unknown order", async () => {
      const unknown = await track("ORD-999999", "0771119002", "198.51.100.21").catch((e) => e);
      expect(unknown).toMatchObject({ code: "NOT_FOUND" });
    });

    it("understands the order number however it is typed", () => {
      for (const v of ["ORD-000123", "ord-123", "ORD 123", "123", " 000123 "]) expect(trackSchema.parse({ reference: v, phone: "0771119003" }).reference).toBe("ORD-000123");
      expect(trackSchema.parse({ reference: " 482 719 366 " }).reference).toBe("482719366");
      // a mistyped number (wrong check digit) is refused before any lookup
      expect(trackSchema.safeParse({ reference: "482719365" }).success).toBe(false);
      for (const v of ["", "abc", "ORD-1234567", "12-34"]) expect(trackSchema.safeParse({ reference: v, phone: "0771119003" }).success).toBe(false);
    });

    it("limits how often one order number can be guessed", async () => {
      const { reference } = await place({ phone: "0771119004" }, [[stoolVariant, 1]]);
      for (let i = 0; i < 8; i++) await track(reference, `07711190${50 + i}`, `198.51.100.${30 + i}`).catch(() => undefined);
      await expect(track(reference, "0771119004", "198.51.100.99")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    });

    it("limits how many lookups one address can make", async () => {
      for (let i = 0; i < 15; i++) await track("ORD-000001", "0771119005", "198.51.100.200").catch(() => undefined);
      await expect(track("ORD-000001", "0771119005", "198.51.100.200")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    });
  });
});

describe.skipIf(!hasTestDb)("website messages (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let staff: Actor, nobody: Actor;
  const send = (o: Record<string, unknown>, ip = "203.0.113.200") => submitEnquiry(enquirySchema.parse({ consent: "on", fileIds: [], ...o }), { ip });

  beforeAll(async () => {
    t = await setupApp();
    staff = await makeActor(t, ["staff"]);
    nobody = await makeActor(t, []);
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("stores a contact message, lists it for staff, and lets staff mark it handled and reopen it", async () => {
    const { id, reference } = await send({ kind: "general", name: "Kamal Silva", phone: "0771110010", message: "Do you export to Singapore?" });
    expect(reference).toMatch(/^MSG-\d{6}$/);
    const open = await listMessages(staff, { state: "open", page: 1, pageSize: 10 });
    expect(open.rows.map((r) => r.id)).toContain(id);
    expect(open.open).toBe(1);
    await setMessageHandled(staff, id, true);
    expect((await listMessages(staff, { state: "open", page: 1, pageSize: 10 })).rows).toHaveLength(0);
    expect((await getMessage(staff, id)).message).toMatchObject({ isHandled: true });
    await setMessageHandled(staff, id, false);
    expect((await getMessage(staff, id)).message.isHandled).toBe(false);
  });

  it("keeps the custom-furniture details", async () => {
    const { id } = await send({ kind: "custom", name: "Nimal", phone: "0771110001", furnitureType: "Dining table", dimensions: "200 x 100", material: "Teak" }, "203.0.113.201");
    const { message } = await getMessage(staff, id);
    expect(message.kind).toBe("custom");
    expect(message.payload).toMatchObject({ furnitureType: "Dining table", dimensions: "200 x 100", material: "Teak" });
  });

  it("is staff-only to read or handle messages", async () => {
    const [m] = await t.sql`SELECT id FROM messages LIMIT 1`;
    await expect(listMessages(nobody, { page: 1, pageSize: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getMessage(nobody, m!.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setMessageHandled(nobody, m!.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("limits how many messages one address can send", async () => {
    for (let i = 0; i < 5; i++) await send({ kind: "general", name: "Spam", phone: `07713000${i}0`, message: "Hello there, a message" }, "203.0.113.250");
    await expect(send({ kind: "general", name: "Spam", phone: "0771399999", message: "Hello there, a message" }, "203.0.113.250")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
