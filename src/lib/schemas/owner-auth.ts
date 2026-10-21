import { z } from "zod";

/** The owner's own sign-in: forgotten password, new password, and the six-digit authenticator code. */
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

/** What an authenticator app shows: six digits (spaces typed in the middle are ignored). */
export const ownerCodeSchema = z.object({
  code: z
    .string({ error: "Enter the 6-digit code." })
    .transform((v) => v.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.")),
  next: z.string().optional(),
});

export const ownerEnrollSchema = z.object({
  factorId: z.uuid({ error: "Start the set-up again." }),
  code: ownerCodeSchema.shape.code,
});
