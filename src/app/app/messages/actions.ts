"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { messageHandledSchema } from "@/lib/schemas/orders";
import { closeQuoteSchema, quoteToOrderSchema, sendQuoteSchema } from "@/lib/schemas/quotations";
import { closeQuotation, createOrderFromQuotation, sendQuote, setMessageHandled } from "@/server/messages";

export async function setHandledAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, messageHandledSchema, async (input, { actor }) => {
    await setMessageHandled(actor!, input.id, input.handled);
    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${input.id}`);
    revalidatePath("/app");
    return { message: input.handled ? "Marked as handled." : "Moved back to open." };
  });
}

const refreshMessage = (id: string) => {
  revalidatePath("/app/messages");
  revalidatePath(`/app/messages/${id}`);
  revalidatePath("/app/orders");
  revalidatePath("/app");
};

export async function sendQuoteAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, sendQuoteSchema, async (input, { actor }) => {
    await sendQuote(actor!, input.id, input);
    refreshMessage(input.id);
    return { message: "The price has been sent. The customer can see it in their account and by email." };
  });
}

export async function closeQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, closeQuoteSchema, async (input, { actor }) => {
    await closeQuotation(actor!, input.id, input.reason);
    refreshMessage(input.id);
    return { message: "The quotation has been closed." };
  });
}

export async function createOrderFromQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, quoteToOrderSchema, async (input, { actor }) => {
    const order = await createOrderFromQuotation(actor!, input.id, input);
    refreshMessage(input.id);
    return { redirectTo: `/app/orders/${order.id}` };
  });
}
