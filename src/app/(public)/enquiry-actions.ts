"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { checkFormToken, HONEYPOT_FIELD, verifyTurnstile } from "@/lib/form-guard";
import { validation } from "@/lib/errors";
import { clientIp } from "@/lib/rate-limit";
import { activeCustomer } from "@/lib/auth/customer";
import { quoteRef } from "@/lib/quotation-ui";
import { enquirySchema } from "@/lib/schemas/enquiry";
import { submitEnquiry } from "@/server/messages";
import { notifyNewMessage } from "@/server/notify";

/** A made-to-order request is a quotation request and is numbered QUO-…; everything else is an enquiry numbered MSG-…. */
const THANKS = (ref: string, custom = false) =>
  `We have received your ${custom ? "request" : "enquiry"} (reference ${custom ? quoteRef(ref) : ref}). Someone from the team will contact you using the details you gave.`;

export async function submitEnquiryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    formData,
    enquirySchema,
    async (input, ctx) => {
      // Bots tend to fill every field. Pretend it worked so they learn nothing, but store nothing.
      if (input[HONEYPOT_FIELD]) return { message: THANKS("MSG-000000", input.kind === "custom") };

      const token = checkFormToken(input.formToken);
      if (token === "too-fast") throw validation("That was very quick. Please check your details and send the form again.");
      if (token !== "ok") throw validation("This form has expired. Please reload the page and try again.");

      const ip = clientIp(ctx.headers);
      if (!(await verifyTurnstile(input["cf-turnstile-response"], ip))) {
        throw validation("We could not confirm you are a person. Please try again.");
      }

      // A signed-in customer is always sent under their own account details, whatever the form carried.
      const customer = await activeCustomer();
      const who = customer ? { ...input, name: customer.fullName, email: customer.email ?? input.email, phone: customer.phone ?? input.phone } : input;
      const { id, reference } = await submitEnquiry(who, { ip, accountId: customer?.id ?? null });
      notifyNewMessage(id);
      return { message: THANKS(reference, input.kind === "custom") };
    },
    { public: true },
  );
}
