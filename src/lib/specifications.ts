import { slugify } from "@/lib/contact";

/**
 * Product specifications: one uniform list of "type → value" rows, shared by the staff form, the server and the public product page.
 * A row is a plain text value, a list of values (several materials, say) or a set of dimensions (W / D / H with a unit).
 */
export const DIM_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export type DimUnit = (typeof DIM_UNITS)[number];
export type SpecType = "text" | "list" | "dims";

export interface Dims {
  w: string;
  d: string;
  h: string;
  unit: DimUnit;
}

export interface SpecEntry {
  /** Catalogue key ("material"), or "custom-…" for a type the staff typed in. */
  key: string;
  label: string;
  type: SpecType;
  values: string[];
  dims?: Dims;
}

export interface SpecCatalogItem {
  key: string;
  label: string;
  type: SpecType;
  group: string;
  /** Offered as you type; anything else can still be entered. */
  suggestions?: string[];
  placeholder?: string;
}

export const SPEC_GROUPS = ["Material and finish", "Size and weight", "Layout and use", "Make and care"] as const;

const WOODS = ["Teak", "Mahogany", "Rubber wood", "Acacia", "Albezia", "Attonia", "Jack", "Grandis", "Paremara", "Duriyan", "Nadun", "Oak", "Pine", "Walnut"];

/** Every kind of product the business makes or sells is covered here; anything else is added with "Add your own type". */
export const SPEC_CATALOG: SpecCatalogItem[] = [
  { key: "material", label: "Material", type: "list", group: "Material and finish", suggestions: [...WOODS, "Plywood", "MDF", "Metal", "Glass", "Fabric", "Leather", "Rattan", "Marble"], placeholder: "e.g. Teak" },
  { key: "finish", label: "Finish", type: "list", group: "Material and finish", suggestions: ["Natural", "Matt lacquer", "Gloss lacquer", "Polished", "Oiled", "Waxed", "Stained", "Painted", "Veneer", "Unfinished"] },
  { key: "colour", label: "Colour", type: "list", group: "Material and finish", suggestions: ["Natural", "Dark brown", "Light brown", "Walnut", "Honey", "White", "Black", "Grey"] },
  { key: "treatment", label: "Wood treatment", type: "list", group: "Material and finish", suggestions: ["Kiln dried", "Air dried", "Seasoned", "Treated", "Untreated"] },
  { key: "grade", label: "Grade", type: "text", group: "Material and finish", placeholder: "e.g. Grade A" },
  { key: "upholstery", label: "Upholstery", type: "list", group: "Material and finish", suggestions: ["Fabric", "Leather", "Faux leather", "Cane", "Rattan", "None"] },
  { key: "glass", label: "Glass", type: "list", group: "Material and finish", suggestions: ["Clear", "Frosted", "Tinted", "Toughened", "Laminated"] },
  { key: "hardware", label: "Hardware and fittings", type: "text", group: "Material and finish", placeholder: "e.g. Brass hinges" },

  { key: "dimensions", label: "Dimensions", type: "dims", group: "Size and weight" },
  { key: "thickness", label: "Thickness", type: "text", group: "Size and weight", placeholder: "e.g. 25 mm" },
  { key: "length", label: "Length", type: "text", group: "Size and weight", placeholder: "e.g. 2.4 m" },
  { key: "width", label: "Width", type: "text", group: "Size and weight", placeholder: "e.g. 150 mm" },
  { key: "diameter", label: "Diameter", type: "text", group: "Size and weight", placeholder: "e.g. 35 cm" },
  { key: "seat-height", label: "Seat height", type: "text", group: "Size and weight", placeholder: "e.g. 45 cm" },
  { key: "weight", label: "Weight", type: "text", group: "Size and weight", placeholder: "e.g. 18 kg" },
  { key: "load", label: "Load capacity", type: "text", group: "Size and weight", placeholder: "e.g. 120 kg" },

  { key: "seating", label: "Seating capacity", type: "text", group: "Layout and use", placeholder: "e.g. 6 people" },
  { key: "drawers", label: "Drawers", type: "text", group: "Layout and use", placeholder: "e.g. 3" },
  { key: "shelves", label: "Shelves", type: "text", group: "Layout and use", placeholder: "e.g. 4" },
  { key: "doors", label: "Number of doors", type: "text", group: "Layout and use", placeholder: "e.g. 2" },
  { key: "opening", label: "Opening style", type: "list", group: "Layout and use", suggestions: ["Hinged", "Sliding", "Casement", "Tilt and turn", "Fixed"] },
  { key: "mounting", label: "Mounting", type: "list", group: "Layout and use", suggestions: ["Free standing", "Wall mounted", "Floor"] },
  { key: "shape", label: "Shape", type: "list", group: "Layout and use", suggestions: ["Rectangular", "Round", "Oval", "Square"] },
  { key: "style", label: "Style", type: "list", group: "Layout and use", suggestions: ["Classic", "Modern", "Rustic", "Colonial", "Minimal"] },
  { key: "room", label: "Suitable for", type: "list", group: "Layout and use", suggestions: ["Living room", "Dining room", "Bedroom", "Kitchen", "Office", "Outdoor", "Hotel", "Restaurant"] },

  { key: "origin", label: "Origin", type: "text", group: "Make and care", placeholder: "e.g. Made in Sri Lanka" },
  { key: "assembly", label: "Assembly", type: "text", group: "Make and care", placeholder: "e.g. Delivered assembled" },
  { key: "customisation", label: "Customisation", type: "list", group: "Make and care", suggestions: ["Custom size", "Choice of wood", "Choice of finish", "Engraving", "Carving"] },
  { key: "warranty", label: "Warranty", type: "text", group: "Make and care", placeholder: "e.g. 2 years" },
  { key: "packaging", label: "Packaging", type: "text", group: "Make and care", placeholder: "e.g. Export wrapped" },
];

export const catalogItem = (key: string) => SPEC_CATALOG.find((c) => c.key === key);

/** "W 180 × L 90 × H 75 cm" (width, length, height). Blank sides are left out. The length is stored as `d`, as it was when it was called depth. */
export function formatDims(d: Dims): string {
  const parts = [d.w && `W ${d.w}`, d.d && `L ${d.d}`, d.h && `H ${d.h}`].filter(Boolean);
  return parts.length ? `${parts.join(" × ")} ${d.unit}` : "";
}

/** Reads "W 180 × L 90 × H 75 cm" (or the older "D" for depth) back into its parts. Anything it cannot read comes back null and stays as text. */
export function parseDimsText(text: string): Dims | null {
  const t = text.trim();
  if (!/^[WDLH]\s*[\d.]+(\s*[×x]\s*[WDLH]\s*[\d.]+)*\s*(mm|cm|m|in|ft)?$/i.test(t)) return null;
  const unit = (t.match(/(mm|cm|m|in|ft)\s*$/i)?.[1]?.toLowerCase() ?? "cm") as DimUnit;
  const get = (letter: string) => t.match(new RegExp(`${letter}\\s*([\\d.]+)`, "i"))?.[1] ?? "";
  return { w: get("W"), d: get("L") || get("D"), h: get("H"), unit };
}

/** Drops empty rows and writes each dimensions row's text, so every row can be shown or searched as plain values. */
export function normalizeSpecs(entries: SpecEntry[]): SpecEntry[] {
  const out: SpecEntry[] = [];
  for (const e of entries) {
    if (e.type === "dims") {
      const text = e.dims ? formatDims(e.dims) : "";
      const values = text ? [text] : e.values.filter(Boolean).slice(0, 1);
      if (values.length) out.push({ ...e, values, dims: text ? e.dims : undefined });
      continue;
    }
    const values = e.values.map((v) => v.trim()).filter(Boolean);
    if (values.length) out.push({ key: e.key, label: e.label, type: e.type, values: e.type === "text" ? [values.join(", ")] : values });
  }
  return out;
}

/** The older single-value columns that search, filters and quote links still read. */
export function legacyColumns(specs: SpecEntry[]) {
  const joined = (key: string) => specs.find((s) => s.key === key)?.values.join(", ") || null;
  return { material: joined("material"), finish: joined("finish"), dimensions: joined("dimensions"), colour: joined("colour") };
}

export const specText = (e: SpecEntry) => e.values.join(", ");

/** A type the staff created, saved for later products. */
export interface SavedSpecType {
  key: string;
  label: string;
  type: "text" | "list";
}

/** The key a created type is stored under: the same name always gives the same key. A name that is already a built-in type uses that type's key. */
export function specKeyFor(label: string): string {
  const clean = label.trim();
  const builtin = SPEC_CATALOG.find((c) => c.label.toLowerCase() === clean.toLowerCase());
  return builtin ? builtin.key : `custom-${slugify(clean) || "type"}`;
}

/** True when a value is already one of a built-in type's own suggestions (so it does not need saving). */
export const isBuiltinSuggestion = (key: string, value: string) => (catalogItem(key)?.suggestions ?? []).some((s) => s.toLowerCase() === value.trim().toLowerCase());
