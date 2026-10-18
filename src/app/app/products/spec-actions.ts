"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { reqText } from "@/lib/validation";
import { saveSpecType, saveSpecValue } from "@/server/specs";

/** Saves a specification type the moment it is created. Hands the saved type back in `data`. */
export async function createSpecTypeAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({
      label: reqText("Specification name", 60),
      type: z.enum(["text", "list"]),
    }),
    async (input, { actor }) => ({
      data: await saveSpecType(actor!, input.label, input.type),
    }),
  );
}

/** Saves a value (a material name, say) the moment it is added to a several-value specification. */
export async function saveSpecValueAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ key: reqText("Type", 80), value: reqText("Value", 200) }),
    async (input, { actor }) => {
      await saveSpecValue(actor!, input.key, input.value);
    },
  );
}
