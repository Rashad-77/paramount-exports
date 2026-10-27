"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { enumOf, reqDate, reqText, reqUuid } from "@/lib/validation";
import { addManualGoogleReview, deleteGoogleReviews, setGoogleReviewsHidden } from "@/server/google-review-store";

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

/** The ids of the reviews ticked in the list, one value per ticked row. */
const idsField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(reqUuid("review")).min(1, "Select at least one review.").max(100, "Select up to 100 reviews at a time."),
);

const plural = (n: number) => `${n} ${n === 1 ? "review" : "reviews"}`;

export async function setReviewsHiddenAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField, hidden: enumOf(["true", "false"], "choice") }), async (input, { actor }) => {
    const n = await setGoogleReviewsHidden(actor!, input.ids, input.hidden === "true");
    refresh();
    return { message: input.hidden === "true" ? `${plural(n)} hidden from the website.` : `${plural(n)} shown on the website.` };
  });
}

export async function deleteReviewsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const n = await deleteGoogleReviews(actor!, input.ids);
    refresh();
    return { message: `${plural(n)} deleted.` };
  });
}
