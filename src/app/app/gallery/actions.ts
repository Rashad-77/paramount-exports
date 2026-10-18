"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { galleryProjectSchema, imagesSchema } from "@/lib/schemas/catalogue";
import { reqUuid } from "@/lib/validation";
import {
  attachGalleryImages,
  createGalleryProject,
  removeGalleryImage,
  setGalleryArchived,
  updateGalleryProject,
} from "@/server/catalogue";

const refresh = (id?: string) => {
  revalidatePath("/app/gallery");
  if (id) revalidatePath(`/app/gallery/${id}`);
  revalidatePath("/gallery");
};

export async function createGalleryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, galleryProjectSchema, async (input, { actor }) => {
    const id = await createGalleryProject(actor!, input);
    refresh(id);
    return { redirectTo: `/app/gallery/${id}` };
  });
}

export async function updateGalleryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    galleryProjectSchema.extend({ id: reqUuid("project") }),
    async (input, { actor }) => {
      await updateGalleryProject(actor!, input.id, input);
      refresh(input.id);
      return { message: `Project "${input.title}" saved.` };
    },
  );
}

export async function archiveGalleryAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ id: reqUuid("project"), archive: z.enum(["true", "false"]) }),
    async (input, { actor }) => {
      await setGalleryArchived(actor!, input.id, input.archive === "true");
      refresh(input.id);
      return {
        message:
          input.archive === "true"
            ? "Project archived and hidden from the website."
            : "Project restored (still unpublished until you publish it).",
      };
    },
  );
}

export async function addGalleryImagesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    imagesSchema.extend({ projectId: reqUuid("project") }),
    async (input, { actor }) => {
      await attachGalleryImages(
        actor!,
        input.projectId,
        input.fileIds,
        input.altText,
      );
      refresh(input.projectId);
      return { message: `${input.fileIds.length} ${input.fileIds.length === 1 ? "image" : "images"} added to the project.` };
    },
  );
}

export async function removeGalleryImageAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ imageId: reqUuid("image"), projectId: reqUuid("project") }),
    async (input, { actor }) => {
      await removeGalleryImage(actor!, input.imageId);
      refresh(input.projectId);
      return { message: "Image removed from the project." };
    },
  );
}
