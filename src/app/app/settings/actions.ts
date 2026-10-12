"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { businessFormSchema, crmFormSchema, pagesFormSchema } from "@/lib/schemas/settings";
import { updateBusiness, updateCrmSettings, updatePages } from "@/server/settings";

const refresh = () => {
  revalidatePath("/", "layout");
  revalidatePath("/app/settings");
};

export async function updateBusinessAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, businessFormSchema, async (input, { actor }) => {
    await updateBusiness(actor!, input);
    refresh();
    return { message: "Business details saved. The website updates within a few minutes." };
  });
}

export async function updatePagesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, pagesFormSchema, async (input, { actor }) => {
    await updatePages(actor!, input);
    refresh();
    return { message: "Page content saved." };
  });
}

export async function updateCrmAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, crmFormSchema, async (input, { actor }) => {
    await updateCrmSettings(actor!, input);
    refresh();
    return { message: "Enquiry settings saved." };
  });
}
