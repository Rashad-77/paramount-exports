"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { clearCatalogueCache } from "@/server/catalogue-cache";
import { categoryCreateSchema, categorySchema } from "@/lib/schemas/catalogue";
import { validation } from "@/lib/errors";
import { reqUuid } from "@/lib/validation";
import {
  createCategoryWithSubs,
  reorderMainCategories,
  deleteCategories,
  setCategoriesArchived,
  updateCategory,
} from "@/server/catalogue";

const refresh = () => {
  clearCatalogueCache();
  revalidatePath("/app/categories");
  revalidatePath("/products");
  revalidatePath("/", "layout");
};

export async function createCategoryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, categoryCreateSchema, async (input, { actor }) => {
    const sub = input.kind === "sub";
    if (sub && !input.parentId) throw validation("Choose the main category this subcategory goes under.", { parentId: ["Choose the main category this subcategory goes under."] });
    const { id: _id, parentName } = await createCategoryWithSubs(actor!, { ...input, parentId: sub ? input.parentId : undefined }, sub ? [] : input.subs);
    void _id;
    refresh();
    const subs = sub ? 0 : input.subs.length;
    return {
      message: sub
        ? `Subcategory "${input.name}" added under ${parentName ?? "its main category"}.`
        : subs > 0
          ? `Main category "${input.name}" added with ${plural(subs, "subcategory", "subcategories")}.`
          : `Main category "${input.name}" added.`,
    };
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
/** "1 category", "3 subcategories" or "2 categories and 1 subcategory", whichever the change touched. */
const what = (total: number, subs: number) =>
  [total - subs > 0 ? plural(total - subs, "category", "categories") : "", subs > 0 ? plural(subs, "subcategory", "subcategories") : ""].filter(Boolean).join(" and ") || "0 categories";

export async function archiveCategoriesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ ids: idsField, mode: z.enum(["archive", "restore"]) }),
    async (input, { actor }) => {
      const archive = input.mode === "archive";
      const r = await setCategoriesArchived(actor!, input.ids, archive);
      refresh();
      const done = archive ? `${what(r.changed, r.subs)} archived and hidden from the website.` : `${what(r.changed, r.subs)} restored.`;
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
    const done = `${what(r.deleted, r.subs)} deleted.`;
    return { message: r.kept.length ? `${done} Not deleted because they still have products or subcategories: ${r.kept.join(", ")}. Archive them instead, or move what is inside first.` : done };
  });
}

export async function reorderCategoriesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const n = await reorderMainCategories(actor!, input.ids);
    refresh();
    return { message: `Display order saved for ${plural(n, "main category", "main categories")}.` };
  });
}
