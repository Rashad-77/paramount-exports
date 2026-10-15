/** The ways the collection can be ordered. Prices that are not shown publicly are never used, so those pieces always come last. */
export const CATALOGUE_SORTS = [
  { value: "newest", label: "Sort by: Newest" },
  { value: "name", label: "Sort by: Name (A–Z)" },
  { value: "price-high", label: "Sort by: Price, high to low" },
  { value: "price-low", label: "Sort by: Price, low to high" },
] as const;

export type CatalogueSort = (typeof CATALOGUE_SORTS)[number]["value"];

export const parseSort = (v: string | null | undefined): CatalogueSort => CATALOGUE_SORTS.find((s) => s.value === v)?.value ?? "newest";
