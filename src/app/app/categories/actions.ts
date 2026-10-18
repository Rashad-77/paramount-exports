"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { categorySchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import {
  createCategory,
  deleteCategories,
  setCategoriesArchived,
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

/** One or many category ids submitted under the same field name by the list's edit mode. */
const idsField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(reqUuid("category")).min(1, "Select at least one category.").max(200, "Select up to 200 categories at a time."),
);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function archiveCategoriesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ ids: idsField, archive: z.enum(["true", "false"]) }),
    async (input, { actor }) => {
      const archive = input.archive === "true";
      const r = await setCategoriesArchived(actor!, input.ids, archive);
      refresh();
      const done = archive ? `${plural(r.changed, "category", "categories")} archived and hidden from the website.` : `${plural(r.changed, "category", "categories")} restored.`;
      return { message: r.skipped.length ? `${done} Not archived because they still have products: ${r.skipped.join(", ")}. Move or archive those products first.` : done };
    },
  );
}

export async function deleteCategoriesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const r = await deleteCategories(actor!, input.ids);
    refresh();
    const done = `${plural(r.deleted, "category", "categories")} deleted.`;
    return { message: r.kept.length ? `${done} Not deleted because they still have products or subcategories: ${r.kept.join(", ")}. Archive them instead, or move what is inside first.` : done };
  });
}
