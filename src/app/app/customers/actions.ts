"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { customerSchema } from "@/lib/schemas/crm";
import { reqUuid } from "@/lib/validation";
import { createCustomer, setCustomerArchived, updateCustomer } from "@/server/customers";

export async function createCustomerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, customerSchema, async (input, { actor }) => {
    const id = await createCustomer(actor!, input);
    revalidatePath("/app/customers");
    return { redirectTo: `/app/customers/${id}` };
  });
}

export async function updateCustomerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, customerSchema.extend({ id: reqUuid("customer") }), async (input, { actor }) => {
    await updateCustomer(actor!, input.id, input);
    revalidatePath(`/app/customers/${input.id}`);
    revalidatePath("/app/customers");
    return { message: "Customer saved." };
  });
}

export async function archiveCustomerAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("customer"), archive: z.enum(["true", "false"]) }), async (input, { actor }) => {
    await setCustomerArchived(actor!, input.id, input.archive === "true");
    revalidatePath(`/app/customers/${input.id}`);
    revalidatePath("/app/customers");
    return { message: input.archive === "true" ? "Customer archived." : "Customer restored." };
  });
}
