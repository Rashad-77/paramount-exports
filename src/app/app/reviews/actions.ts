"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { enumOf, reqDate, reqText, reqUuid } from "@/lib/validation";
import { addManualGoogleReview, deleteGoogleReview, setGoogleReviewHidden } from "@/server/google-review-store";

const refresh = () => {
  revalidatePath("/app/reviews");
  revalidatePath("/");
};

const addSchema = z.object({
  author: reqText("The reviewer's name", 80),
  rating: enumOf(["1", "2", "3", "4", "5"], "number of stars"),
  body: reqText("The review", 2000),
  postedOn: reqDate("The date posted"),
});

export async function addReviewAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, addSchema, async (input, { actor }) => {
    await addManualGoogleReview(actor!, { author: input.author, rating: Number(input.rating), body: input.body, postedOn: input.postedOn });
    refresh();
    return { message: "Review added. It shows on the homepage now." };
  });
}

export async function setReviewHiddenAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("review"), hidden: enumOf(["true", "false"], "choice") }), async (input, { actor }) => {
    await setGoogleReviewHidden(actor!, input.id, input.hidden === "true");
    refresh();
    return { message: input.hidden === "true" ? "Review hidden from the website." : "Review shown on the website." };
  });
}

export async function deleteReviewAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ id: reqUuid("review") }), async (input, { actor }) => {
    await deleteGoogleReview(actor!, input.id);
    refresh();
    return { message: "Review deleted." };
  });
}
