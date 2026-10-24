import { describe, expect, it } from "vitest";
import { categoryOptions } from "@/lib/category-tree";
import { productSchema, productUpdateSchema } from "@/lib/schemas/catalogue";
import { formatDims, legacyColumns, normalizeSpecs, parseDimsText, type SpecEntry } from "@/lib/specifications";

const base = { name: "Oak table", categoryId: "4ca1b82b-a149-4bf2-aece-d2558c77aaaa", kind: "stocked" };

describe("dimensions", () => {
  it("writes width, depth and height with one unit, leaving blank sides out", () => {
    expect(formatDims({ w: "180", d: "90", h: "75", unit: "cm" })).toBe("W 180 × L 90 × H 75 cm");
    expect(formatDims({ w: "120", d: "", h: "", unit: "mm" })).toBe("W 120 mm");
    expect(formatDims({ w: "", d: "", h: "", unit: "cm" })).toBe("");
  });

  it("reads the older depth (D) as length, and gives up on anything else", () => {
    expect(parseDimsText("W 160 × D 45 × H 80 cm")).toEqual({ w: "160", d: "45", h: "80", unit: "cm" });
    expect(parseDimsText("W 160 × L 45 × H 80 cm")).toEqual({ w: "160", d: "45", h: "80", unit: "cm" });
    expect(parseDimsText("W 2.4 m")).toEqual({ w: "2.4", d: "", h: "", unit: "m" });
    expect(parseDimsText("Ø 35 × H 45 cm")).toBeNull();
    expect(parseDimsText("about a metre")).toBeNull();
  });
});

describe("specification rows", () => {
  const rows: SpecEntry[] = [
    { key: "material", label: "Material", type: "list", values: ["Teak", " Oak ", ""] },
    { key: "finish", label: "Finish", type: "list", values: [] },
    { key: "dimensions", label: "Dimensions", type: "dims", values: [""], dims: { w: "120", d: "60", h: "45", unit: "cm" } },
    { key: "custom-1", label: "Weight", type: "text", values: ["about 70 kg", ""] },
    { key: "colour", label: "Colour", type: "list", values: ["Natural"] },
  ];

  it("drops empty rows, trims values and writes each dimensions row as text", () => {
    const out = normalizeSpecs(rows);
    expect(out.map((r) => r.key)).toEqual(["material", "dimensions", "custom-1", "colour"]);
    expect(out[0]!.values).toEqual(["Teak", "Oak"]);
    expect(out[1]!.values).toEqual(["W 120 × L 60 × H 45 cm"]);
  });

  it("keeps older free-text dimensions that have not been filled in yet", () => {
    const out = normalizeSpecs([{ key: "dimensions", label: "Dimensions", type: "dims", values: ["Ø 35 × H 45 cm"], dims: { w: "", d: "", h: "", unit: "cm" } }]);
    expect(out[0]!.values).toEqual(["Ø 35 × H 45 cm"]);
  });

  it("keeps the older single-value columns in step: several materials are joined", () => {
    expect(legacyColumns(normalizeSpecs(rows))).toEqual({ material: "Teak, Oak", finish: null, dimensions: "W 120 × L 60 × H 45 cm", colour: "Natural" });
  });
});

describe("product form rules", () => {
  it("needs an amount when the piece is in stock", () => {
    const r = productUpdateSchema.safeParse({ ...base, visibility: "published", availability: "in_stock" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["stockQuantity"]);
    expect(productUpdateSchema.safeParse({ ...base, visibility: "published", availability: "in_stock", stockQuantity: "4", photos: ["id:0f043c10-69bf-40e5-8180-df1f73005e47"] }).success).toBe(true);
    expect(productUpdateSchema.safeParse({ ...base, visibility: "draft", availability: "made_to_order" }).success).toBe(true);
  });

  it("reads the specification list and the photo order the form sends", () => {
    const r = productUpdateSchema.parse({
      ...base,
      visibility: "archived",
      specifications: JSON.stringify([{ key: "material", label: "Material", type: "list", values: ["Teak"] }]),
      photos: ["id:0f043c10-69bf-40e5-8180-df1f73005e47", "file:5f31f04d-9b84-451b-8e2d-45b32a7a292d"],
    });
    expect(r.specifications?.[0]?.values).toEqual(["Teak"]);
    expect(r.photos).toHaveLength(2);
  });

  it("refuses broken specification or photo data", () => {
    expect(productUpdateSchema.safeParse({ ...base, visibility: "draft", specifications: "{not json" }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ ...base, visibility: "draft", photos: ["../../etc/passwd"] }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ ...base, visibility: "draft", specifications: JSON.stringify([{ key: "dimensions", label: "Dimensions", type: "dims", values: [], dims: { w: "abc", d: "", h: "", unit: "cm" } }]) }).success).toBe(false);
  });
});

describe("photos are required", () => {
  const photo = "file:5f31f04d-9b84-451b-8e2d-45b32a7a292d";
  it("a new product needs at least one photo, even as a draft", () => {
    const none = productSchema.safeParse({ ...base, visibility: "draft", sku: "SKU-1" });
    expect(none.success).toBe(false);
    expect(none.error?.issues.some((i) => i.path[0] === "photos")).toBe(true);
    expect(productSchema.safeParse({ ...base, visibility: "draft", sku: "SKU-1", photos: [photo] }).success).toBe(true);
  });

  it("an existing product may stay a draft without photos, but cannot be published without one", () => {
    expect(productUpdateSchema.safeParse({ ...base, visibility: "draft" }).success).toBe(true);
    const published = productUpdateSchema.safeParse({ ...base, visibility: "published" });
    expect(published.success).toBe(false);
    expect(published.error?.issues.some((i) => i.path[0] === "photos")).toBe(true);
    expect(productUpdateSchema.safeParse({ ...base, visibility: "published", photos: [photo] }).success).toBe(true);
  });
});

describe("category drop-down", () => {
  const cats = [
    { id: "t", name: "Timber and Wood Planks", parentId: null },
    { id: "t1", name: "Teak", parentId: "t" },
    { id: "f", name: "Furniture", parentId: null },
    { id: "f1", name: "Tables", parentId: "f" },
    { id: "c", name: "Custom Manufacturing", parentId: null },
  ];

  it("shows a group with categories as a heading and lists them indented under it", () => {
    const o = categoryOptions(cats);
    expect(o.map((x) => [x.label, x.heading ?? false, x.indent ?? false])).toEqual([
      ["Timber and Wood Planks", true, false],
      ["Teak", false, true],
      ["Furniture", true, false],
      ["Tables", false, true],
      ["Custom Manufacturing", false, false],
    ]);
    expect(o.find((x) => x.label === "Tables")?.display).toBe("Furniture › Tables");
  });

  it("lets a group be picked when asked (filters), or when a product is already filed straight under it", () => {
    expect(categoryOptions(cats, { groupsPickable: true }).some((x) => x.heading)).toBe(false);
    expect(categoryOptions(cats, { keepId: "f" }).find((x) => x.label === "Furniture")?.heading).toBeUndefined();
  });
});
