"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import {
  businessFormSchema,
  pagesFormSchema,
} from "@/lib/schemas/settings";
import { updateBusiness, updatePages } from "@/server/settings";

const refresh = () => {
  revalidatePath("/", "layout");
  revalidatePath("/app/settings");
  revalidatePath("/app/website");
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

export async function updatePagesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, pagesFormSchema, async (input, { actor }) => {
    // The business history section and the typed-in reviews were removed from the form; their stored text is cleared with every save.
    await updatePages(actor!, { ...input, history: null, historyIntro: null, testimonials: null });
    refresh();
    return { message: "Website page text saved." };
  });
}

