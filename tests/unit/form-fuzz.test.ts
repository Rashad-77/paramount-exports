import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/schemas/orders";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { signUpSchema, signInSchema, forgotSchema, profileSchema, addressSchema, claimOrderSchema } from "@/lib/schemas/accounts";
import { trackSchema } from "@/lib/schemas/tracking";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const weird = ["", " ", "   ", "\n", "\t", "\0", "a\0b", "<script>alert(1)</script>", "'; DROP TABLE orders;--", "😀", "සිංහල", "العربية", "x".repeat(5000), "  padded  ", "A@B.COM", " a@b.com ", "a@b", "a b@c.com", "ａ＠ｂ.com"];
const phones = ["0719825855", "+94719825855", "94719825855", "071 982 5855", "071-982-5855", "(071) 9825855", "0719825855 ", " 0719825855", "0719825855abc", "abc", "123", "1234567890123456", "+", "٠٧١٩٨٢٥٨٥٥", "071982585５"];
const cart = (q: unknown) => JSON.stringify([{ variantId: uuid, quantity: q }]);
const carts = ["", "[]", "{}", "null", "not json", cart(1), cart(0), cart(-1), cart(1.5), cart("2"), cart(1e9), cart(null), JSON.stringify([{ variantId: "x", quantity: 1 }]), JSON.stringify(Array.from({ length: 200 }, () => ({ variantId: uuid, quantity: 1 })))];

describe("forms never throw, whatever is entered", () => {
  it("checkout: every combination of fulfilment, payment, phone, email, cart", () => {
    const outcomes: Record<string, boolean> = {};
    for (const fulfilment of ["delivery", "pickup", "", "x"]) for (const paymentMethod of ["on_delivery", "bank_transfer", "at_showroom", "", "x"])
      for (const phone of phones) for (const email of weird) for (const c of carts) {
        const r = checkoutSchema.safeParse({ name: "Test", phone, email, fulfilment, paymentMethod, line1: "1 Road", city: "Kandy", postalCode: "20000", cart: c });
        if (r.success) outcomes[`${fulfilment}|${paymentMethod}`] = true;
      }
    // Only the sensible combinations can ever pass.
    expect(Object.keys(outcomes).sort()).toEqual(["delivery|bank_transfer", "delivery|on_delivery", "pickup|at_showroom", "pickup|bank_transfer"]);
  });

  it("checkout: delivery needs an address, pickup stores none", () => {
    const base = { name: "T", phone: "0719825855", paymentMethod: "bank_transfer", cart: cart(1) };
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, fulfilment: "delivery", address: "1 Road, Kandy" }).success).toBe(true);
    const p = checkoutSchema.safeParse({ ...base, fulfilment: "pickup", line1: "x", city: "y", postalCode: "1" });
    expect(p.success && p.data.address).toBeUndefined();
  });

  it("enquiry: all kinds with odd text, dates, units, contact methods", () => {
    for (const kind of ["general", "product_enquiry", "custom", "", "x"]) for (const text of weird) for (const date of ["", "2020-01-01", "2999-12-31", "31/12/2030", "2030-02-30", "x"])
      for (const pc of ["", "email", "phone", "whatsapp", "sms"]) {
        const run = () => enquirySchema.safeParse({ kind, name: text, phone: "0719825855", email: "", preferredContact: pc, message: text, productId: "", furnitureType: text, dimensions: text, dimensionUnit: "", targetDate: date });
        expect(run).not.toThrow();
      }
  });

  it("enquiry: pasted emails with stray spaces or capitals are accepted", () => {
    const base = { kind: "general", name: "T", phone: "0719825855", message: "a long enough message" };
    for (const email of [" a@b.com", "a@b.com ", "A@B.COM", "\ta@b.com\n"]) expect(enquirySchema.safeParse({ ...base, email }).success, JSON.stringify(email)).toBe(true);
  });

  it("sign up / sign in / forgot: spaces and capitals in the email", () => {
    for (const email of [" a@b.com", "a@b.com ", "A@B.COM"]) {
      expect(signInSchema.safeParse({ email, password: "x" }).success, "signin " + email).toBe(true);
      expect(forgotSchema.safeParse({ email }).success, "forgot " + email).toBe(true);
      expect(signUpSchema.safeParse({ fullName: "T", email, password: "password1", confirmPassword: "password1" }).success, "signup " + email).toBe(true);
    }
  });

  it("passwords: lengths, spaces, unicode", () => {
    const ok = (p: string) => signUpSchema.safeParse({ fullName: "T", email: "a@b.com", password: p, confirmPassword: p }).success;
    expect(ok("1234567")).toBe(false);
    expect(ok("12345678")).toBe(true);
    expect(ok(" ".repeat(10))).toBe(false);
    expect(ok("x".repeat(72))).toBe(true);
    expect(ok("x".repeat(73))).toBe(false);
    expect(ok("pässwörd😀")).toBe(true);
  });

  it("order tracking numbers: formats customers actually type", () => {
    for (const ok of ["ORD-000123", "ord 123", "123", "ORD000123", " 123 "]) expect(trackSchema.safeParse({ reference: ok }).success, ok).toBe(true);
    for (const bad of ["", "abc", "ORD-", "1234567", "000000000", "ORD-1234567", "12345678901"]) expect(trackSchema.safeParse({ reference: bad }).success, bad).toBe(false);
  });

  it("account forms do not throw on weird input", () => {
    for (const t of weird) for (const p of phones) {
      expect(() => profileSchema.safeParse({ fullName: t, phone: p })).not.toThrow();
      expect(() => addressSchema.safeParse({ line1: t, line2: t, city: t, postalCode: t })).not.toThrow();
      expect(() => claimOrderSchema.safeParse({ reference: t, phone: p })).not.toThrow();
    }
  });
});
