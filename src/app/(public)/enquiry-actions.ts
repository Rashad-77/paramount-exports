"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { checkFormToken, HONEYPOT_FIELD, verifyTurnstile } from "@/lib/form-guard";
import { validation } from "@/lib/errors";
import { clientIp } from "@/lib/rate-limit";
import { activeCustomer } from "@/lib/auth/customer";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { submitEnquiry } from "@/server/messages";

const THANKS = (ref: string) =>
  `We have received your enquiry (reference ${ref}). Someone from the team will contact you using the details you gave.`;

export async function submitEnquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    formData,
    enquirySchema,
    async (input, ctx) => {
      // Bots tend to fill every field. Pretend it worked so they learn nothing, but store nothing.
      if (input[HONEYPOT_FIELD]) return { message: THANKS("MSG-000000") };

      const token = checkFormToken(input.formToken);
      if (token === "too-fast") throw validation("That was very quick. Please check your details and send the form again.");
      if (token !== "ok") throw validation("This form has expired. Please reload the page and try again.");

      const ip = clientIp(ctx.headers);
      if (!(await verifyTurnstile(input["cf-turnstile-response"], ip))) {
        throw validation("We could not confirm you are a person. Please try again.");
      }

      const { reference } = await submitEnquiry(input, { ip, accountId: (await activeCustomer())?.id ?? null });
      return { message: THANKS(reference) };
    },
    { public: true },
  );
}
