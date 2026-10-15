"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { messageHandledSchema } from "@/lib/schemas/orders";
import { setMessageHandled } from "@/server/messages";

export async function setHandledAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, messageHandledSchema, async (input, { actor }) => {
    await setMessageHandled(actor!, input.id, input.handled);
    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${input.id}`);
    revalidatePath("/app");
    return { message: input.handled ? "Marked as handled." : "Moved back to open." };
  });
}
