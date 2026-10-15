"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { categorySchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import {
  createCategory,
  setCategoryArchived,
  updateCategory,
} from "@/server/catalogue";

const refresh = () => {
  revalidatePath("/app/categories");
  revalidatePath("/products");
  revalidatePath("/", "layout");
};

export async function createCategoryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, categorySchema, async (input, { actor }) => {
    await createCategory(actor!, input);
    refresh();
    return { redirectTo: "/app/categories" };
  });
}

export async function updateCategoryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    categorySchema.safeExtend({ id: reqUuid("category") }),
    async (input, { actor }) => {
      await updateCategory(actor!, input.id, input);
      refresh();
      return { redirectTo: "/app/categories" };
    },
  );
}

const archiveSchema = z.object({
  id: reqUuid("category"),
  archive: z.enum(["true", "false"]),
});
export async function archiveCategoryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, archiveSchema, async (input, { actor }) => {
    await setCategoryArchived(actor!, input.id, input.archive === "true");
    refresh();
    return {
      message:
        input.archive === "true" ? "Category archived." : "Category restored.",
    };
  });
}
