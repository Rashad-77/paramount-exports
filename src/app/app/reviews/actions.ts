"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { REVIEW_STATUSES } from "@/lib/db/schema";
import { deleteReview, setReviewStatus } from "@/server/reviews";

const refresh = () => {
  revalidatePath("/app/reviews");
  revalidatePath("/");
};

export async function reviewStatusAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: z.uuid(), status: z.enum(REVIEW_STATUSES) }), async (input, { actor }) => {
    await setReviewStatus(actor!, input.id, input.status);
    refresh();
    return { message: input.status === "approved" ? "Review is showing on the homepage again." : "Review hidden from the homepage." };
  });
}

export async function deleteReviewAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: z.uuid() }), async (input, { actor }) => {
    await deleteReview(actor!, input.id);
    refresh();
    return { message: "Review deleted." };
  });
}
