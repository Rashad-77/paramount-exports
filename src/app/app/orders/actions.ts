"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import {
  orderDetailsSchema,
  orderPaidSchema,
  orderStatusSchema,
} from "@/lib/schemas/orders";
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
    });
    refresh(input.id);
    return { message: "Order delivery charge, schedule and note saved." };
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
