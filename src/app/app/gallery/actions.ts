"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { galleryAddSchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import { addGalleryPhotos, removeGalleryPhoto } from "@/server/catalogue";

const refresh = () => {
  revalidatePath("/app/gallery");
  revalidatePath("/gallery");
};

export async function addGalleryPhotosAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, galleryAddSchema, async (input, { actor }) => {
    await addGalleryPhotos(actor!, input.area, input.fileIds);
    refresh();
    return { message: `${input.fileIds.length} ${input.fileIds.length === 1 ? "photo" : "photos"} added.` };
  });
}

export async function removeGalleryPhotoAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ photoId: reqUuid("photo") }), async (input, { actor }) => {
    await removeGalleryPhoto(actor!, input.photoId);
    refresh();
    return { message: "Photo removed." };
  });
}
