"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { deleteCustomers } from "@/server/orders";

/** The phone number keys of the customers ticked in the list, one value per ticked row. */
const keysField = z.preprocess(
  (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.string().regex(/^\d{6,15}$/, "That is not a customer.")).min(1, "Select at least one customer.").max(50, "Select up to 50 customers at a time."),
);

export async function deleteCustomersAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(fd, z.object({ keys: keysField }), async (input, { actor }) => {
    const r = await deleteCustomers(actor!, input.keys);
    revalidatePath("/app/customers");
    revalidatePath("/app/orders");
    revalidatePath("/app/enquiries");
    revalidatePath("/app/quotations");
    revalidatePath("/app", "layout");
    const parts = [
      r.orders ? `${r.orders} ${r.orders === 1 ? "order" : "orders"}` : null,
      r.messages ? `${r.messages} ${r.messages === 1 ? "enquiry or quotation" : "enquiries and quotations"}` : null,
      r.accounts ? `${r.accounts} website ${r.accounts === 1 ? "account" : "accounts"}` : null,
    ].filter(Boolean);
    return { message: `${r.customers} ${r.customers === 1 ? "customer" : "customers"} deleted${parts.length ? `, with ${parts.join(", ")}` : ""}.` };
  });
}
