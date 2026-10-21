"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { productSchema, productUpdateSchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import { createProduct, deleteProducts, setProductsArchived, setProductsPublished, setProductsUnpublished, updateProduct } from "@/server/catalogue";

const refresh = (id?: string) => {
  revalidatePath("/app/products");
  if (id) revalidatePath(`/app/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/premium");
  revalidatePath("/", "layout");
};

export async function createProductAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, productSchema, async (input, { actor }) => {
    const id = await createProduct(actor!, input);
    refresh(id);
    return { redirectTo: `/app/products/${id}` };
  });
}

export async function updateProductAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ id: reqUuid("product") }).and(productUpdateSchema),
    async (input, { actor }) => {
      await updateProduct(actor!, input.id, input);
      refresh(input.id);
      return { message: `Product "${input.name}" saved.` };
    },
  );
}

/** One or many product ids submitted under the same field name by the list's edit mode. */
const idsField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(reqUuid("product")).min(1, "Select at least one product.").max(200, "Select up to 200 products at a time."),
);

export async function archiveProductsAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ ids: idsField, mode: z.enum(["archive", "restore", "unpublish", "publish"]) }),
    async (input, { actor }) => {
      if (input.mode === "publish") {
        const n = await setProductsPublished(actor!, input.ids);
        refresh();
        return { message: `${n} ${n === 1 ? "product" : "products"} published on the website.` };
      }
      if (input.mode === "unpublish") {
        const n = await setProductsUnpublished(actor!, input.ids);
        refresh();
        return { message: `${n} ${n === 1 ? "product" : "products"} taken off the website (kept as drafts).` };
      }
      const archive = input.mode === "archive";
      const n = await setProductsArchived(actor!, input.ids, archive);
      refresh();
      return {
        message: archive
          ? `${n} ${n === 1 ? "product" : "products"} archived and hidden from the website.`
          : `${n} ${n === 1 ? "product" : "products"} restored (still unpublished until you publish).`,
      };
    },
  );
}

export async function deleteProductsAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const n = await deleteProducts(actor!, input.ids);
    refresh();
    return {
      message: `${n} ${n === 1 ? "product" : "products"} deleted.`,
    };
  });
}
