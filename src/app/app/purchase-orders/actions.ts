"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { validation } from "@/lib/errors";
import { invoiceSchema, poCancelSchema, poIdSchema, poBodySchema, poLineSchema, poUpdateSchema, receiveSchema, supplierPaymentSchema } from "@/lib/schemas/purchasing";
import { cancelPurchaseOrder, createPurchaseOrder, markPurchaseOrderSent, receiveGoods, recordSupplierInvoice, recordSupplierPayment, updateDraftPurchaseOrder } from "@/server/purchasing";

const refresh = (id?: string) => {
  revalidatePath("/app/purchase-orders");
  revalidatePath("/app/stock");
  revalidatePath("/app/materials");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/purchase-orders/${id}`);
};

function lines(raw: unknown[]) {
  const out = [];
  for (const [i, r] of raw.entries()) {
    const p = poLineSchema.safeParse(r);
    if (!p.success) throw validation(`Line ${i + 1}: choose an item and enter a quantity and cost.`, { itemsJson: [`Line ${i + 1}: choose an item and enter a quantity and cost.`] });
    out.push({ itemId: p.data.itemId, quantity: p.data.quantity, expectedUnitCost: p.data.expectedUnitCost });
  }
  return out;
}

export async function createPoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, poBodySchema, async (input, { actor }) => {
    const id = await createPurchaseOrder(actor!, { supplierId: input.supplierId, locationId: input.locationId, expectedOn: input.expectedOn, notes: input.notes, items: lines(input.itemsJson as unknown[]) });
    refresh(id);
    return { redirectTo: `/app/purchase-orders/${id}` };
  });
}

export async function updatePoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, poUpdateSchema, async (input, { actor }) => {
    await updateDraftPurchaseOrder(actor!, input.id, { supplierId: input.supplierId, locationId: input.locationId, expectedOn: input.expectedOn, notes: input.notes, items: lines(input.itemsJson as unknown[]) });
    refresh(input.id);
    return { redirectTo: `/app/purchase-orders/${input.id}` };
  });
}

export async function sendPoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, poIdSchema, async (input, { actor }) => {
    await markPurchaseOrderSent(actor!, input.id);
    refresh(input.id);
    return { message: "Marked as sent to the supplier." };
  });
}

export async function cancelPoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, poCancelSchema, async (input, { actor }) => {
    await cancelPurchaseOrder(actor!, input.id, input.reason);
    refresh(input.id);
    return { message: "Purchase order cancelled." };
  });
}

export async function receiveGoodsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, receiveSchema, async (input, { actor }) => {
    const entries = Object.entries(input).filter(([k]) => k.startsWith("qty_"));
    const r = await receiveGoods(actor!, input.id, {
      note: input.note,
      lines: entries.map(([k, v]) => ({ purchaseOrderItemId: k.slice(4), quantity: String(v) })),
    });
    refresh(input.id);
    return { message: `Receipt ${r.reference} recorded. Stock has been increased by the quantities received.` };
  });
}

export async function recordInvoiceAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, invoiceSchema, async (input, { actor }) => {
    await recordSupplierInvoice(actor!, input.id, input);
    refresh(input.id);
    return { message: "Supplier invoice recorded." };
  });
}

export async function recordSupplierPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, supplierPaymentSchema, async (input, { actor }) => {
    await recordSupplierPayment(actor!, input.id, input);
    refresh(input.id);
    return { message: "Payment recorded." };
  });
}
