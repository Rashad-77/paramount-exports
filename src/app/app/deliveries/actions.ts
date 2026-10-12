"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { DELIVERY_STATUS_LABEL } from "@/lib/schemas/operations";
import { deliverySchema, deliveryStatusSchema, deliveryUpdateSchema, rescheduleSchema } from "@/lib/schemas/operations";
import { createDelivery, rescheduleDelivery, setDeliveryStatus, updateDelivery } from "@/server/deliveries";

const refresh = (id?: string, orderId?: string) => {
  revalidatePath("/app/deliveries");
  revalidatePath("/app");
  revalidatePath("/app/stock");
  if (id) revalidatePath(`/app/deliveries/${id}`);
  if (orderId) revalidatePath(`/app/orders/${orderId}`);
};

export async function createDeliveryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, deliverySchema, async (input, { actor }) => {
    const id = await createDelivery(actor!, input);
    refresh(id, input.orderId);
    return { redirectTo: `/app/deliveries/${id}` };
  });
}

export async function updateDeliveryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, deliveryUpdateSchema, async (input, { actor }) => {
    const { id, ...rest } = input;
    await updateDelivery(actor!, id, rest);
    refresh(id);
    return { message: "Delivery details saved." };
  });
}

export async function deliveryStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, deliveryStatusSchema, async (input, { actor }) => {
    await setDeliveryStatus(actor!, input.id, input.to, { note: input.note, proofFileIds: input.proofFileIds });
    refresh(input.id);
    revalidatePath("/app/orders");
    return { message: input.to === "delivered" ? "Marked delivered. The order is now delivered and its stock has been deducted." : `Marked “${DELIVERY_STATUS_LABEL[input.to]}”.` };
  });
}

export async function rescheduleDeliveryAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, rescheduleSchema, async (input, { actor }) => {
    const id = await rescheduleDelivery(actor!, input.id, input);
    refresh(id);
    return { redirectTo: `/app/deliveries/${id}` };
  });
}
