"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { deleteEnquiries } from "@/server/messages";

/** The ids of the enquiries ticked in the list, one value per ticked row. */
const idsField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.uuid("That is not an enquiry.")).min(1, "Select at least one enquiry.").max(50, "Select up to 50 enquiries at a time."),
);

export async function deleteEnquiriesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ ids: idsField }), async (input, { actor }) => {
    const n = await deleteEnquiries(actor!, input.ids);
    revalidatePath("/app/enquiries");
    revalidatePath("/app/quotations");
    revalidatePath("/app", "layout");
    return { message: `${n} ${n === 1 ? "enquiry" : "enquiries"} deleted.` };
  });
}
