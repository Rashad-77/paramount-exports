"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { clearCatalogueCache } from "@/server/catalogue-cache";
import {
  orderDetailsSchema,
  orderPaidSchema,
  orderStatusSchema,
  voidPaymentSchema,
} from "@/lib/schemas/orders";
import { voidPayment } from "@/server/order-money";
import {
  setOrderPaid,
  setOrderStatus,
  updateOrderDetails,
} from "@/server/orders";

const refresh = (id: string) => {
  clearCatalogueCache();
  revalidatePath("/app/orders");
  revalidatePath(`/app/orders/${id}`);
  revalidatePath("/app");
  revalidatePath("/app/customers");
  // Cancelling, refunding or reopening an order puts pieces back on the shelf or takes them again: the stored product pages show the stock.
  revalidatePath("/products/[slug]", "page");
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
    return { message: "Order pricing saved." };
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

export async function voidPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, voidPaymentSchema.extend({ id: z.uuid() }), async (input, { actor }) => {
    await voidPayment(actor!, input.paymentId, input.reason);
    refresh(input.id);
    return { message: "Entry voided. It stays on record but is no longer counted." };
  });
}
