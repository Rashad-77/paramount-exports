import { z } from "zod";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { MAX_LINES, MAX_QTY } from "@/lib/order-constants";
import { idList, optText, reqPhone, reqText } from "@/lib/validation";
import { normaliseOrderRef } from "./tracking";

/** Passwords: long enough to resist guessing, short enough for the sign-in service (it ignores anything past 72 characters). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .min(1, "Enter your email address.")
  .max(200, "That email address is too long.")
  .email("Enter a valid email address.");

const newPassword = z
  .string({ error: "Choose a password." })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .refine((v) => v.trim().length > 0, "A password cannot be only spaces.");

const optPhone = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), reqPhone.optional());

export const signUpSchema = z
  .object({
    fullName: reqText("Your name", 120),
    email,
    phone: optPhone,
    password: newPassword,
    confirmPassword: z.string({ error: "Type the password again." }),
    next: z.string().optional(),
    [HONEYPOT_FIELD]: z.string().optional(),
    formToken: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two passwords do not match." });
    if (v.password.toLowerCase() === v.email.toLowerCase()) ctx.addIssue({ code: "custom", path: ["password"], message: "Do not use your email address as your password." });
  });

export const signInSchema = z.object({
  email,
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(200),
  next: z.string().optional(),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export const forgotSchema = z.object({ email, [HONEYPOT_FIELD]: z.string().optional() });

export const resetSchema = z
  .object({ newPassword, confirmPassword: z.string({ error: "Type the password again." }) })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two passwords do not match." });
  });

/** One uploaded picture for the profile picture form. */
export const avatarSchema = z.object({ fileIds: idList(1).refine((a) => a.length === 1, { message: "Choose a picture first." }) });

export const profileSchema = z.object({
  fullName: reqText("Your name", 120),
  phone: optPhone,
  address: optText("Address", 400),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string({ error: "Enter your current password." }).min(1, "Enter your current password.").max(200),
    newPassword,
    confirmPassword: z.string({ error: "Type the new password again." }),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two passwords do not match." });
    if (v.newPassword === v.currentPassword) ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from your current one." });
  });

/** Deleting needs the person to type their email, so it cannot happen by accident. */
export const deleteAccountSchema = z.object({ confirmEmail: z.string().trim().min(1, "Type your email address to confirm.") });

/** Add an earlier order to the account: the same proof as the public tracking form (order number + the phone used). */
export const claimOrderSchema = z.object({
  reference: z
    .string({ error: "Enter your order number." })
    .trim()
    .min(1, "Enter your order number.")
    .refine((v) => normaliseOrderRef(v) !== null, "Enter your order number, like 482719366.")
    .transform((v) => normaliseOrderRef(v)!),
  phone: reqPhone,
});

/** A saved basket line. Display fields only: prices are always read from the database when an order is placed. */
export const savedCartItemSchema = z.object({
  variantId: z.uuid(),
  productSlug: z.string().max(200),
  productName: z.string().max(300),
  variantLabel: z.string().max(200).nullable(),
  sku: z.string().max(100),
  price: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
  image: z
    .string()
    .max(600)
    .refine((v) => v.startsWith("/") || v.startsWith("https://"), "Not an image address.")
    .nullable(),
  quantity: z.number().int().min(1).max(MAX_QTY),
});
export const savedCartSchema = z.array(savedCartItemSchema).max(MAX_LINES);
export type SavedCartItem = z.infer<typeof savedCartItemSchema>;

/** A saved delivery address. */
export const addressSchema = z.object({
  id: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.uuid().optional()),
  line1: reqText("Address line 1", 120),
  line2: optText("Address line 2", 120),
  line3: optText("Address line 3", 120),
  city: reqText("City", 80),
  postalCode: reqText("Postal code", 20),
});

export const addressIdSchema = z.object({ id: z.uuid({ error: "Choose a valid address." }) });

export const wishlistToggleSchema = z.object({ productId: z.uuid({ error: "Choose a valid product." }) });
