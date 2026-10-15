"use server";

import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { clientIp } from "@/lib/rate-limit";
import { trackSchema } from "@/lib/schemas/tracking";
import { trackOrder } from "@/server/tracking";

/** A customer looks up their order. The answer is sent back to the form; nothing about the order is put in the address bar. */
export async function trackOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(
    formData,
    trackSchema,
    async (input, ctx) => {
      // Bots tend to fill every field: answer as if nothing was found, and look nothing up.
      if (input[HONEYPOT_FIELD]) return { data: null };
      return { data: await trackOrder(input, { ip: clientIp(ctx.headers) }) };
    },
    { public: true },
  );
}
