"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { deleteQuotations } from "@/server/messages";

/** The ids of the quotations ticked in the list, one value per ticked row. */
const idsField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.uuid("That is not a quotation.")).min(1, "Select at least one quotation.").max(50, "Select up to 50 quotations at a time."),
);

export async function deleteQuotationsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const n = await deleteQuotations(actor!, input.ids);
    revalidatePath("/app/quotations");
    revalidatePath("/app/enquiries");
    revalidatePath("/app", "layout");
    return { message: `${n} ${n === 1 ? "quotation" : "quotations"} deleted.` };
  });
}
