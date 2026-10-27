"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { reqText } from "@/lib/validation";
import { deleteSpecType, deleteSpecValue, renameSpecType, renameSpecValue, saveSpecType, saveSpecValue } from "@/server/specs";

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
      // No page is refreshed here: the form on screen stays as it is (the collection page reads the list fresh each time).
      await saveSpecValue(actor!, input.key, input.value);
    },
  );
}

/** Renames one of the staff's own specification types. */
export async function renameSpecTypeAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ key: reqText("Type", 80), label: reqText("Specification name", 60) }),
    async (input, { actor }) => {
      await renameSpecType(actor!, input.key, input.label);
    },
  );
}

/** Removes one of the staff's own specification types from the list. */
export async function deleteSpecTypeAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ key: reqText("Type", 80) }),
    async (input, { actor }) => {
      await deleteSpecType(actor!, input.key);
    },
  );
}

/** Renames a value in the suggestions (built in or saved). */
export async function renameSpecValueAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ key: reqText("Type", 80), from: reqText("Value", 200), to: reqText("Value", 200) }),
    async (input, { actor }) => {
      await renameSpecValue(actor!, input.key, input.from, input.to);
    },
  );
}

/** Removes a value from the suggestions (built in or saved). */
export async function deleteSpecValueAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(
    fd,
    z.object({ key: reqText("Type", 80), value: reqText("Value", 200) }),
    async (input, { actor }) => {
      await deleteSpecValue(actor!, input.key, input.value);
    },
  );
}
