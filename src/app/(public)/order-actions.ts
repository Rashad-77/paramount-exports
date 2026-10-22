"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { validation } from "@/lib/errors";
import { activeCustomer } from "@/lib/auth/customer";
import { getAccountSettings } from "@/lib/settings";
import { checkFormToken, HONEYPOT_FIELD, verifyTurnstile } from "@/lib/form-guard";
import { getDb } from "@/lib/db/client";
import { clientIp, hitRateLimit, releaseRateLimit } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/schemas/orders";
import { notifyNewOrder } from "@/server/notify";
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

      // When the owner requires accounts, a guest cannot order (the checkout page already says so; this keeps it true if the form is posted directly).
      const customer = await activeCustomer();
      if (!customer && (await getAccountSettings()).requiredForCheckout) throw validation("Please sign in or create an account to place your order.");

      // One form token places one order: a double click or a replayed request is refused. A failed attempt gives the token back.

      const once = { scope: "order-token", value: input.formToken ?? "", windowSeconds: 24 * 3600 };

      if (!(await hitRateLimit(getDb(), { ...once, limit: 1 })).allowed) {

        throw validation("This order has already been sent. Please check your confirmation, or reload the page to start a new order.");

      }

      let placed;

      try {

        placed = await placeOrder(customer ? { ...input, name: customer.fullName, email: customer.email ?? input.email, phone: customer.phone ?? input.phone } : input, { ip, accountId: customer?.id ?? null });

      } catch (e) {

        await releaseRateLimit(getDb(), once).catch(() => undefined);

        throw e;

      }

      const { id, reference } = placed;
      // The order took pieces off the shelf, so the stock shown on the stored product pages is out of date.
      revalidatePath("/products/[slug]", "page");
      notifyNewOrder(id);
      return { redirectTo: `/order/confirmed?ref=${encodeURIComponent(reference)}&pay=${input.paymentMethod}&how=${input.fulfilment}` };
    },
    { public: true },
  );
}
