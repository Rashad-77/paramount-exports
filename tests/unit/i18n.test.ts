import { describe, expect, it } from "vitest";
import { NAV } from "@/lib/nav";
import { STATUS_LABEL, PAYMENT_LABEL, FULFILMENT_LABEL } from "@/lib/order-constants";
import { normalise, toSinhala } from "@/lib/i18n/translate";
import { SI } from "@/lib/i18n/si";
import { parseLang } from "@/lib/i18n/lang";

const SINHALA = /[\u0D80-\u0DFF]/;

describe("Sinhala dictionary", () => {
  it("keeps every key in the normal form the translator looks up", () => {
    for (const k of Object.keys(SI)) expect(normalise(k), JSON.stringify(k)).toBe(k);
  });

  it("gives every text a Sinhala translation (names are not listed, so they stay English)", () => {
    for (const [k, v] of Object.entries(SI)) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      // Only "Google Place ID" is kept whole in English on purpose.
      if (k !== "Google Place ID") expect(SINHALA.test(v), `${k} → ${v}`).toBe(true);
    }
  });

  it("leaves the names the owner wants in English", () => {
    expect(SI["Google Place ID"]).toBe("Google Place ID");
    for (const name of ["Facebook", "TikTok", "WhatsApp", "LKR", "Teak"]) expect(SI[name], name).toBeUndefined();
    expect(toSinhala("Facebook")).toBeNull();
    expect(toSinhala("Paramount Export Industries")).toBeNull();
    expect(toSinhala("Table")).toBeNull();
    expect(toSinhala("ORD-000123")).toBeNull();
  });

  it("keeps English names inside Sinhala sentences", () => {
    expect(toSinhala("Facebook link")).toContain("Facebook");
    expect(toSinhala("TikTok link")).toContain("TikTok");
    expect(toSinhala("WhatsApp number")).toContain("WhatsApp");
    expect(toSinhala("Google review link")).toContain("Google");
  });

  it("translates the whole menu, with its group names and descriptions", () => {
    for (const g of NAV) {
      expect(toSinhala(g.label), g.label).not.toBeNull();
      for (const m of g.modules) {
        expect(toSinhala(m.label), m.label).not.toBeNull();
        expect(toSinhala(m.description), m.description).not.toBeNull();
        for (const p of m.pages) expect(toSinhala(p.label), p.label).not.toBeNull();
      }
    }
  });

  it("translates the order statuses and payment words", () => {
    for (const label of [...Object.values(STATUS_LABEL), ...Object.values(PAYMENT_LABEL), ...Object.values(FULFILMENT_LABEL)]) expect(toSinhala(label), label).not.toBeNull();
  });

  it("ignores spacing differences and returns null for text it does not hold", () => {
    expect(toSinhala("  Save \n")).toBe(SI.Save);
    expect(toSinhala("Some brand new sentence nobody translated")).toBeNull();
    expect(toSinhala("")).toBeNull();
  });
});

describe("Sinhala patterns", () => {
  it("carries names and numbers over unchanged", () => {
    expect(toSinhala('Product "Teak table" saved.')).toContain('"Teak table"');
    expect(toSinhala("Page 2 of 5")).toBe("පිටුව 2 / 5");
    expect(toSinhala("Delete (3)")).toBe("මකන්න (3)");
    expect(toSinhala("Delete 3 products?")).toContain("3");
    expect(toSinhala("New (4)")).toBe("අලුත් (4)");
    expect(toSinhala("Price (LKR)")).toBe("මිල (LKR)");
    expect(toSinhala("Placed 27 Oct 2026, 3:15 pm")).toContain("27 Oct 2026, 3:15 pm");
    expect(toSinhala("2 products published on the website.")).toContain("2");
    expect(toSinhala("Order status changed to out_for_delivery.".replace(/_/g, " "))).not.toBeNull();
  });

  it("does not touch a lone number or a name", () => {
    expect(toSinhala("14,000")).toBeNull();
    expect(toSinhala("Kapila Bandara")).toBeNull();
  });
});

describe("language choice", () => {
  it("falls back to English", () => {
    expect(parseLang("si")).toBe("si");
    expect(parseLang("en")).toBe("en");
    expect(parseLang("de")).toBe("en");
    expect(parseLang(undefined)).toBe("en");
  });
});
