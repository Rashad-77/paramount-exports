import { z } from "zod";

/** The owner's own sign-in: forgotten password and new password. */
export const OWNER_PASSWORD_MIN = 12;

export const ownerForgotSchema = z.object({
  email: z.string({ error: "Enter your email address." }).trim().min(1, "Enter your email address.").max(200).email("Enter a valid email address."),
});

export const ownerResetSchema = z
  .object({
    newPassword: z
      .string({ error: "Choose a new password." })
      .min(OWNER_PASSWORD_MIN, `Use at least ${OWNER_PASSWORD_MIN} characters.`)
      .max(72, "Use at most 72 characters.")
      .refine((v) => v.trim().length > 0, "A password cannot be only spaces."),
    confirmPassword: z.string({ error: "Type the new password again." }),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two passwords do not match." });
  });
