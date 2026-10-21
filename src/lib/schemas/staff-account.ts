import { z } from "zod";
import { reqText } from "@/lib/validation";
export { passwordChangeSchema } from "@/lib/schemas/accounts";

/** The signed-in staff member's own account page. */
export const staffNameSchema = z.object({ fullName: reqText("Your name", 120) });

export const staffEmailSchema = z.object({
  email: z
    .string({ error: "Enter your new email address." })
    .trim()
    .min(1, "Enter your new email address.")
    .max(200, "That email address is too long.")
    .email("Enter a valid email address."),
});
