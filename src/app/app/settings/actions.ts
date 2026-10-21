"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { businessFormSchema } from "@/lib/schemas/settings";
import { updateBusiness } from "@/server/settings";

const refresh = () => {
  revalidatePath("/", "layout");
  revalidatePath("/app/settings");
};

export async function updateBusinessAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, businessFormSchema, async (input, { actor }) => {
    await updateBusiness(actor!, input);
    refresh();
    return {
      message:
        "Business details saved. The website updates within a few minutes.",
    };
  });
}
