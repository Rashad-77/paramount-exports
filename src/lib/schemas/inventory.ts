import { z } from "zod";
import { checkbox, enumOf, optMoney, quantity, reqText, reqUuid } from "@/lib/validation";

export const ITEM_KINDS = ["finished_good", "raw_material", "consumable"] as const;
export const ITEM_KIND_LABEL: Record<string, string> = { finished_good: "Finished goods", raw_material: "Raw material", consumable: "Consumable" };
export const LOCATION_KINDS = ["showroom", "workshop", "warehouse"] as const;

const sku = z
  .string({ error: "SKU is required." })
  .trim()
  .min(1, "SKU is required.")
  .max(60)
  .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, hyphens and underscores only.");

export const itemCreateSchema = z.object({
  kind: enumOf(ITEM_KINDS, "stock type"),
  sku,
  name: reqText("Name", 120),
  unit: reqText("Unit", 20),
  costPrice: optMoney("Cost"),
});

export const itemUpdateSchema = z.object({ id: reqUuid("item"), name: reqText("Name", 120), unit: reqText("Unit", 20), costPrice: optMoney("Cost"), isActive: checkbox });

export const MANUAL_KINDS = ["opening", "receipt", "adjustment_up", "adjustment_down", "waste"] as const;
export const MANUAL_KIND_LABEL: Record<(typeof MANUAL_KINDS)[number], string> = {
  opening: "Opening balance (first count)",
  receipt: "Received stock",
  adjustment_up: "Correction: add (found more)",
  adjustment_down: "Correction: remove (counted fewer)",
  waste: "Write-off (damaged / wasted)",
};

export const manualMovementSchema = z.object({
  itemId: reqUuid("item"),
  locationId: reqUuid("location"),
  kind: enumOf(MANUAL_KINDS, "type of change"),
  quantity: quantity("Quantity"),
  reason: reqText("Reason", 300),
});

export const thresholdSchema = z.object({
  itemId: reqUuid("item"),
  locationId: reqUuid("location"),
  threshold: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.union([z.null(), quantity("Threshold", { allowZero: true })])),
});

export const locationSchema = z.object({ id: z.preprocess((v) => (v === "" ? undefined : v), reqUuid("location").optional()), name: reqText("Name", 80), kind: enumOf(LOCATION_KINDS, "location type"), isActive: checkbox });

const transferLines = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return undefined;
    }
  },
  z.array(z.object({ itemId: reqUuid("item"), quantity: quantity("Quantity") }), { error: "Add at least one item." }).min(1, "Add at least one item.").max(50),
);
export const transferSchema = z.object({ fromLocationId: reqUuid("source location"), toLocationId: reqUuid("destination"), note: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(300).optional()), linesJson: transferLines });
