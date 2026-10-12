"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { supplierArchiveSchema, supplierSchema } from "@/lib/schemas/purchasing";
import { saveSupplier, setSupplierArchived } from "@/server/purchasing";

export async function saveSupplierAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, supplierSchema, async (input, { actor }) => {
    const id = await saveSupplier(actor!, input);
    revalidatePath("/app/suppliers");
    return { redirectTo: `/app/suppliers/${id}` };
  });
}

export async function archiveSupplierAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, supplierArchiveSchema, async (input, { actor }) => {
    await setSupplierArchived(actor!, input.id, input.archived === "1");
    revalidatePath("/app/suppliers");
    revalidatePath(`/app/suppliers/${input.id}`);
    return { message: input.archived === "1" ? "Supplier archived. History is kept." : "Supplier restored." };
  });
}
