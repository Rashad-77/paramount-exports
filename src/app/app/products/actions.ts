"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { imagesSchema, productSchema, productUpdateSchema, variantSchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import { addVariant, attachProductImages, createProduct, makeMainImage, removeProductImage, setProductArchived, updateProduct, updateVariant } from "@/server/catalogue";

const refresh = (id?: string) => {
  revalidatePath("/app/products");
  if (id) revalidatePath(`/app/products/${id}`);
  revalidatePath("/products");
  revalidatePath("/", "layout");
};

export async function createProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, productSchema, async (input, { actor }) => {
    const id = await createProduct(actor!, input);
    refresh(id);
    return { redirectTo: `/app/products/${id}` };
  });
}

export async function updateProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("product") }).and(productUpdateSchema), async (input, { actor }) => {
    await updateProduct(actor!, input.id, input);
    refresh(input.id);
    return { message: "Product saved." };
  });
}

export async function archiveProductAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("product"), archive: z.enum(["true", "false"]) }), async (input, { actor }) => {
    await setProductArchived(actor!, input.id, input.archive === "true");
    refresh(input.id);
    return { message: input.archive === "true" ? "Product archived and hidden from the website." : "Product restored (it stays unpublished until you publish it)." };
  });
}

export async function addVariantAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, variantSchema.extend({ productId: reqUuid("product") }), async (input, { actor }) => {
    await addVariant(actor!, input.productId, input);
    refresh(input.productId);
    return { message: "Option added." };
  });
}

export async function updateVariantAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, variantSchema.extend({ variantId: reqUuid("option"), productId: reqUuid("product") }), async (input, { actor }) => {
    await updateVariant(actor!, input.variantId, input);
    refresh(input.productId);
    return { message: "Option saved." };
  });
}

export async function addImagesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, imagesSchema.extend({ productId: reqUuid("product") }), async (input, { actor }) => {
    await attachProductImages(actor!, input.productId, input.fileIds, input.altText);
    refresh(input.productId);
    return { message: "Images added." };
  });
}

const imageSchema = z.object({ imageId: reqUuid("image"), productId: reqUuid("product") });
export async function removeImageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, imageSchema, async (input, { actor }) => {
    await removeProductImage(actor!, input.imageId);
    refresh(input.productId);
    return { message: "Image removed." };
  });
}

export async function mainImageAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, imageSchema, async (input, { actor }) => {
    await makeMainImage(actor!, input.imageId);
    refresh(input.productId);
    return { message: "Main image updated." };
  });
}
