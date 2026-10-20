"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import {
  caseSchema,
  itemsSchema,
  orderDetailsSchema,
  orderPaidSchema,
  orderStatusSchema,
  paymentSchema,
  refundSchema,
  resolveCaseSchema,
  voidPaymentSchema,
} from "@/lib/schemas/orders";
import { formatMoney } from "@/lib/money";
import { createCase, recordPayment, recordRefund, resolveCase, updateOrderItems, voidPayment } from "@/server/order-money";
import {
  setOrderPaid,
  setOrderStatus,
  updateOrderDetails,
} from "@/server/orders";

const refresh = (id: string) => {
  revalidatePath("/app/orders");
  revalidatePath(`/app/orders/${id}`);
  revalidatePath("/app");
  revalidatePath("/app/customers");
};

export async function setStatusAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, orderStatusSchema, async (input, { actor }) => {
    await setOrderStatus(actor!, input.id, input.status, input.reason);
    refresh(input.id);
    return {
      message:
        input.status === "cancelled" ? "Order cancelled." : `Order status changed to ${String(input.status).replace(/_/g, " ")}.`,
    };
  });
}

/** Status corrections selected from the orders table can move directly to any tag. */
export async function setStatusFromListAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, orderStatusSchema, async (input, { actor }) => {
    await setOrderStatus(actor!, input.id, input.status, input.reason, true);
    refresh(input.id);
    return {
      message:
        input.status === "cancelled" ? "Order cancelled." : `Order status changed to ${String(input.status).replace(/_/g, " ")}.`,
    };
  });
}

export async function updateDetailsAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, orderDetailsSchema, async (input, { actor }) => {
    await updateOrderDetails(actor!, input.id, {
      deliveryCharge: input.deliveryCharge,
      staffNote: input.staffNote,
      scheduledFor: input.scheduledFor,
      discountAmount: input.discountAmount,
      discountPercent: input.discountPercent,
      discountReason: input.discountReason,
    });
    refresh(input.id);
    return { message: "Order pricing, planned day and note saved." };
  });
}

export async function setPaidAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, orderPaidSchema, async (input, { actor }) => {
    await setOrderPaid(actor!, input.id, input.paid);
    refresh(input.id);
    return { message: input.paid ? "Order marked as paid." : "Order marked as not paid." };
  });
}

export async function recordPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, paymentSchema, async (input, { actor }) => {
    const r = await recordPayment(actor!, input.id, { amount: input.amount, method: input.method, reference: input.reference, note: input.note, paidOn: input.paidOn });
    refresh(input.id);
    return { message: `Payment of ${formatMoney(input.amount, "LKR")} recorded as receipt ${r.number}.${r.isPaid ? " The order is now paid in full." : " Part paid: a balance is still due."}` };
  });
}

export async function voidPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, voidPaymentSchema.extend({ id: z.uuid() }), async (input, { actor }) => {
    await voidPayment(actor!, input.paymentId, input.reason);
    refresh(input.id);
    return { message: "Entry voided. It stays on record but is no longer counted." };
  });
}

export async function refundAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, refundSchema, async (input, { actor }) => {
    const r = await recordRefund(actor!, input.id, { amount: input.amount, method: input.method, reason: input.reason, reference: input.reference, returns: input.returns });
    refresh(input.id);
    const back = input.returns.reduce((n, x) => n + x.quantity, 0);
    return { message: [r.number ? `Refund of ${formatMoney(input.amount, "LKR")} recorded as credit note ${r.number}.` : "Return recorded.", back > 0 ? `${back} ${back === 1 ? "item" : "items"} put back in stock.` : ""].filter(Boolean).join(" ") };
  });
}

export async function updateItemsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, itemsSchema, async (input, { actor }) => {
    await updateOrderItems(actor!, input.id, { changes: input.changes, add: input.add });
    refresh(input.id);
    return { message: "Order items updated. The total and the stock have been adjusted." };
  });
}

export async function createCaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, caseSchema, async (input, { actor }) => {
    await createCase(actor!, input.id, { kind: input.kind, title: input.title, details: input.details });
    refresh(input.id);
    return { message: `After-sales case "${input.title}" opened.` };
  });
}

export async function resolveCaseAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, resolveCaseSchema, async (input, { actor }) => {
    await resolveCase(actor!, input.caseId, input.resolution, input.reopen);
    refresh(input.orderId);
    return { message: input.reopen ? "Case reopened." : "Case marked as resolved." };
  });
}
