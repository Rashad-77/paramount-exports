"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { validation } from "@/lib/errors";
import { advanceSchema, cancelSchema, convertSchema, createOrderSchema, orderIdSchema, paymentSchema, termsSchema, updateOrderSchema, voidSchema } from "@/lib/schemas/orders";
import { parseItems } from "@/lib/schemas/quotation";
import { enableStockTracking } from "@/server/inventory";
import { advanceOrder, cancelOrder, confirmOrder, convertQuotationToOrder, createReadyMadeOrder, recordPayment, updateOrderTerms, updateReadyMadeDraft, voidPayment } from "@/server/orders";
import { reqUuid } from "@/lib/validation";
import { z } from "zod";

const refresh = (id?: string) => {
  revalidatePath("/app/orders");
  revalidatePath("/app/payments");
  revalidatePath("/app/stock");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/orders/${id}`);
};

function lines(raw: unknown[]) {
  const { items, errors } = parseItems(raw);
  if (errors.length) throw validation(errors[0]!, { itemsJson: errors });
  return items;
}

export async function createOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, createOrderSchema, async (input, { actor }) => {
    const id = await createReadyMadeOrder(actor!, { customerId: input.customerId, locationId: input.locationId, deliveryCharge: input.deliveryCharge, depositTerms: input.depositTerms, notes: input.notes, items: lines(input.itemsJson as unknown[]) });
    refresh(id);
    return { redirectTo: `/app/orders/${id}` };
  });
}

export async function updateOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, updateOrderSchema, async (input, { actor }) => {
    await updateReadyMadeDraft(actor!, input.id, { locationId: input.locationId, deliveryCharge: input.deliveryCharge, depositTerms: input.depositTerms, notes: input.notes, items: lines(input.itemsJson as unknown[]) });
    refresh(input.id);
    return { redirectTo: `/app/orders/${input.id}` };
  });
}

export async function updateTermsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, termsSchema, async (input, { actor }) => {
    await updateOrderTerms(actor!, input.id, input);
    refresh(input.id);
    return { message: "Order details saved." };
  });
}

export async function confirmOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, orderIdSchema, async (input, { actor }) => {
    await confirmOrder(actor!, input.id);
    refresh(input.id);
    return { message: "Order confirmed. Stock is now reserved for this customer." };
  });
}

export async function advanceOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, advanceSchema, async (input, { actor }) => {
    await advanceOrder(actor!, input.id, input.to);
    refresh(input.id);
    return { message: input.to === "delivered" ? "Marked delivered. The reserved stock has been deducted." : "Status updated." };
  });
}

export async function cancelOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, cancelSchema, async (input, { actor }) => {
    await cancelOrder(actor!, input.id, input.reason);
    refresh(input.id);
    return { message: "Order cancelled. Any reserved stock has been released." };
  });
}

export async function recordPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, paymentSchema, async (input, { actor }) => {
    await recordPayment(actor!, input);
    refresh(input.orderId);
    return { message: "Payment recorded." };
  });
}

export async function voidPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, voidSchema, async (input, { actor }) => {
    await voidPayment(actor!, input.paymentId, input.reason);
    refresh(input.orderId);
    return { message: "Payment voided. The original entry is kept and a reversal was added." };
  });
}

export async function convertQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, convertSchema, async (input, { actor }) => {
    const id = await convertQuotationToOrder(actor!, input.quotationId, input);
    revalidatePath(`/app/quotations/${input.quotationId}`);
    refresh(id);
    return { redirectTo: `/app/orders/${id}` };
  });
}

export async function enableTrackingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ variantId: reqUuid("option"), productId: reqUuid("product") }), async (input, { actor }) => {
    await enableStockTracking(actor!, input.variantId);
    revalidatePath(`/app/products/${input.productId}`);
    refresh();
    return { message: "Stock tracking is on. Add an opening balance on the Stock page." };
  });
}
