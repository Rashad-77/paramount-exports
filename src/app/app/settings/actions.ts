"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import {
  accountsFormSchema,
  businessFormSchema,
  pagesFormSchema,
} from "@/lib/schemas/settings";
import { updateAccounts, updateBusiness, updatePages } from "@/server/settings";

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
    await updatePages(actor!, input);
    refresh();
    return { message: "Website page text saved." };
  });
}

export async function updateAccountsAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, accountsFormSchema, async (input, { actor }) => {
    await updateAccounts(actor!, input);
    revalidatePath("/", "layout");
    return { message: "Customer account settings saved." };
  });
}
