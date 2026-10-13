"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { validation } from "@/lib/errors";
import { checkFormToken, HONEYPOT_FIELD, verifyTurnstile } from "@/lib/form-guard";
import { clientIp } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/schemas/orders";
import { placeOrder } from "@/server/orders";

/** A visitor places an order. No payment is taken: the customer chooses how they intend to pay and staff confirm. */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    formData,
    checkoutSchema,
    async (input, ctx) => {
      // Bots tend to fill every field. Pretend it worked so they learn nothing, but store nothing.
      if (input[HONEYPOT_FIELD]) return { redirectTo: "/order/confirmed?ref=ORD-000000" };

      const token = checkFormToken(input.formToken);
      if (token === "too-fast") throw validation("That was very quick. Please check your details and place the order again.");
      if (token !== "ok") throw validation("This form has expired. Please reload the page and try again.");

      const ip = clientIp(ctx.headers);
      if (!(await verifyTurnstile(input["cf-turnstile-response"], ip))) {
        throw validation("We could not confirm you are a person. Please try again.");
      }

      const { reference } = await placeOrder(input, { ip });
      return { redirectTo: `/order/confirmed?ref=${encodeURIComponent(reference)}&pay=${input.paymentMethod}&how=${input.fulfilment}` };
    },
    { public: true },
  );
}
