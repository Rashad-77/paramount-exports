"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { businessFormSchema, crmFormSchema, pagesFormSchema } from "@/lib/schemas/settings";
import { updateBusiness, updateCrmSettings, updatePages, updateSalesSettings } from "@/server/settings";
import { z } from "zod";

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

const salesFormSchema = z.object({
  maxDiscountPercent: z
    .string({ error: "Enter a percentage." })
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 5 or 7.5.")
    .refine((v) => Number(v) <= 100, "The limit cannot be more than 100%."),
});

export async function updateSalesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, salesFormSchema, async (input, { actor }) => {
    await updateSalesSettings(actor!, input);
    refresh();
    return { message: "Discount limit saved." };
  });
}
