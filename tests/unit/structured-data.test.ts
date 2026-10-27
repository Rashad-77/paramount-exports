import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS } from "@/lib/settings";
import { breadcrumbLd, collectionLd, faqLd, internationalPhone, localBusinessLd, parseAddress, parseHours, townOf } from "@/lib/structured-data";

describe("structured data", () => {
  it("reads the saved address into street, town, postcode and country", () => {
    expect(parseAddress(DEFAULT_BUSINESS.address)).toEqual({
      "@type": "PostalAddress",
      addressCountry: "LK",
      streetAddress: "Nalanda Ellawala Industrial Zone - Stage 2, Paradise",
      addressLocality: "Kuruwita",
      postalCode: "70500",
    });
    expect(townOf(DEFAULT_BUSINESS.address)).toBe("Kuruwita");
  });

  it("keeps an address it cannot split as one street line", () => {
    expect(parseAddress("12 Main Road\nKandy")).toEqual({ "@type": "PostalAddress", streetAddress: "12 Main Road, Kandy" });
    expect(parseAddress(null)).toBeNull();
    expect(townOf(null)).toBeNull();
  });

  it("reads opening hours and leaves out closed days", () => {
    expect(parseHours(DEFAULT_BUSINESS.openingHours)).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], opens: "08:00", closes: "17:00" },
    ]);
    expect(parseHours("Sunday: 9:30 am – 1:00 pm")[0]).toMatchObject({ dayOfWeek: ["Sunday"], opens: "09:30", closes: "13:00" });
    expect(parseHours("by appointment")).toEqual([]);
    expect(parseHours(null)).toEqual([]);
  });

  it("builds an international phone number", () => {
    expect(internationalPhone("0715500668", "94")).toBe("+94715500668");
    expect(internationalPhone("+94 71 550 0668", "94")).toBe("+94715500668");
    expect(internationalPhone(null, "94")).toBeUndefined();
  });

  it("describes the business from its saved details only", () => {
    const ld = localBusinessLd(DEFAULT_BUSINESS, "https://example.lk", "Solid wood furniture");
    expect(ld).toMatchObject({
      "@type": "FurnitureStore",
      "@id": "https://example.lk/#business",
      name: "Paramount Export Industries",
      telephone: "+94715500668",
      email: "paramountkapila@yahoo.com",
      description: "Solid wood furniture",
      geo: { "@type": "GeoCoordinates", latitude: 6.7602757, longitude: 80.3677279 },
      sameAs: ["https://facebook.com/paramount.export", "https://www.tiktok.com/@paramountexportindustrie"],
    });
    const bare = localBusinessLd({ ...DEFAULT_BUSINESS, phone: null, phoneAlt: null, email: null, address: null, mapUrl: null, openingHours: null, facebook: null, tiktok: null }, "https://example.lk");
    expect(bare).not.toHaveProperty("telephone");
    expect(bare).not.toHaveProperty("address");
    expect(bare).not.toHaveProperty("geo");
    expect(bare).not.toHaveProperty("openingHoursSpecification");
    expect(bare).not.toHaveProperty("sameAs");
  });

  it("numbers breadcrumbs and writes FAQ answers as given", () => {
    expect(breadcrumbLd("https://example.lk", [{ name: "Home", path: "/" }, { name: "Collection", path: "/products" }])).toMatchObject({
      itemListElement: [
        { position: 1, name: "Home", item: "https://example.lk/" },
        { position: 2, name: "Collection", item: "https://example.lk/products" },
      ],
    });
    expect(faqLd([{ q: "Do I pay online?", a: "No." }])).toMatchObject({ mainEntity: [{ name: "Do I pay online?", acceptedAnswer: { text: "No." } }] });
  });

  it("describes a category page as a list of its pieces", () => {
    const ld = collectionLd("https://example.lk", { name: "Dining tables", path: "/collections/dining-tables", items: [{ name: "Oak table", path: "/products/oak-table" }] });
    expect(ld).toMatchObject({
      "@type": "CollectionPage",
      url: "https://example.lk/collections/dining-tables",
      mainEntity: { "@type": "ItemList", itemListElement: [{ position: 1, name: "Oak table", url: "https://example.lk/products/oak-table" }] },
    });
    expect(ld).not.toHaveProperty("description");
  });
});
