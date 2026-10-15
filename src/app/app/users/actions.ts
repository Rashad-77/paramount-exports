"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import { reqUuid } from "@/lib/validation";
import { setUserActive, setUserRoles } from "@/server/users";

const rolesSchema = z.object({
  userId: reqUuid("person"),
  roles: z.preprocess(
    (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]),
    z.array(z.string()).max(10),
  ),
});
const activeSchema = z.object({
  userId: reqUuid("person"),
  active: z.enum(["1", "0"]),
});

export async function setRolesAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, rolesSchema, async (input, { actor }) => {
    await setUserRoles(actor!, input.userId, input.roles);
    revalidatePath("/app/users");
    return { message: "Roles saved." };
  });
}

export async function setActiveAction(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return runAction(fd, activeSchema, async (input, { actor }) => {
    await setUserActive(actor!, input.userId, input.active === "1");
    revalidatePath("/app/users");
    return {
      message:
        input.active === "1"
          ? "Account reactivated."
          : "Account deactivated. They can no longer use the system.",
    };
  });
}
