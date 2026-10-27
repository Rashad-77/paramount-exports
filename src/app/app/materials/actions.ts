"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { reqText } from "@/lib/validation";
import { addMaterial, deleteSpecValue } from "@/server/specs";

const refresh = () => {
  revalidatePath("/app/materials");
  revalidatePath("/app/products", "layout");
};

export async function addMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ name: reqText("Material name", 80) }), async (input, { actor }) => {
    await addMaterial(actor!, input.name);
    refresh();
    return { message: `${input.name} added to the materials.` };
  });
}

export async function deleteMaterialAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ name: reqText("Material name", 200) }), async (input, { actor }) => {
    await deleteSpecValue(actor!, "material", input.name);
    refresh();
    return { message: `${input.name} removed from the materials.` };
  });
}
