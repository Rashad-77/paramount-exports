import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/schemas/orders";
import { enumOf, money, optDate, optText, reqText, reqUuid } from "@/lib/validation";
import { orderItemsJson } from "@/lib/schemas/orders";

export const supplierSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: reqText("Supplier name", 160),
  contactName: optText("Contact person", 120),
  phone: optText("Phone", 40),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.email("Enter a valid email address.").max(200).optional()),
  address: optText("Address", 400),
  suppliedMaterials: optText("Materials supplied", 400),
  notes: optText("Notes", 1000),
});
export const supplierArchiveSchema = z.object({ id: reqUuid("supplier"), archived: z.enum(["1", "0"]) });

export const poBodySchema = z.object({
  supplierId: reqUuid("supplier"),
  locationId: reqUuid("receiving location"),
  expectedOn: optDate,
  notes: optText("Notes", 1000),
  itemsJson: orderItemsJson,
});
export const poUpdateSchema = poBodySchema.extend({ id: reqUuid("purchase order") });

/** Items arrive as JSON: [{ itemId, quantity, expectedUnitCost }]. */
export const poLineSchema = z.object({
  itemId: reqUuid("item"),
  quantity: z.string().trim().min(1, "Enter a quantity."),
  expectedUnitCost: z.string().trim().min(1, "Enter a cost."),
});

export const poIdSchema = z.object({ id: reqUuid("purchase order") });
export const poCancelSchema = z.object({ id: reqUuid("purchase order"), reason: reqText("Reason", 300) });

/** Receipt form fields are named `qty_<purchase order item id>`; empty means nothing received for that line. */
export const receiveSchema = z.object({ id: reqUuid("purchase order"), note: optText("Note", 300) }).catchall(z.string());

export const invoiceSchema = z.object({ id: reqUuid("purchase order"), ref: optText("Invoice number", 80), amount: money("Invoice amount") });
export const supplierPaymentSchema = z.object({
  id: reqUuid("purchase order"),
  amount: money("Amount", { allowZero: false }),
  method: enumOf(PAYMENT_METHODS, "method"),
  reference: optText("Reference", 120),
  note: optText("Note", 300),
});
