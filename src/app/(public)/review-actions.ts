"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { activeCustomer } from "@/lib/auth/customer";
import { validation } from "@/lib/errors";
import { checkFormToken, HONEYPOT_FIELD } from "@/lib/form-guard";
import { clientIp } from "@/lib/rate-limit";
import { reviewSchema } from "@/lib/schemas/reviews";
import { submitReview } from "@/server/reviews";

const THANKS = "Thank you. Your review is now on our website.";

export async function submitReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    formData,
    reviewSchema,
    async (input, ctx) => {
      // Bots tend to fill every field. Pretend it worked so they learn nothing, but store nothing.
      if (input[HONEYPOT_FIELD]) return { message: THANKS };

      const token = checkFormToken(input.formToken);
      if (token === "too-fast") throw validation("That was very quick. Please check your review and send it again.");
      if (token !== "ok") throw validation("This form has expired. Please reload the page and try again.");

      const customer = await activeCustomer();
      await submitReview(customer ? { ...input, name: customer.fullName } : input, { ip: clientIp(ctx.headers), accountId: customer?.id ?? null });
      revalidatePath("/");
      return { message: THANKS };
    },
    { public: true },
  );
}
