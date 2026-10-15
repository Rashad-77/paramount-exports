import { z } from "zod";
import { isPlausiblePhone } from "@/lib/contact";
import { isDecimalString, moneyString, qtyString, dec } from "@/lib/money";

/**
 * Zod building blocks for HTML form input (everything arrives as strings; empty fields arrive as "").
 * Messages are written for end users, not developers.
 */

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const reqText = (label: string, max = 200) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const optText = (label: string, max = 500) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).optional());

export const optEmail = z.preprocess(emptyToUndefined, z.email("Enter a valid email address.").max(200).optional());

export const reqPhone = z
  .string({ error: "Phone number is required." })
  .trim()
  .min(1, "Phone number is required.")
  .refine(isPlausiblePhone, "Enter a valid phone number (7–15 digits; spaces, +, - and brackets are fine).");

export const optDate = z.preprocess(emptyToUndefined, z.iso.date("Enter a valid date.").optional());
export const reqDate = (label: string) => z.iso.date({ error: `${label} must be a valid date.` });

export const reqUuid = (label: string) => z.uuid({ error: `Choose a valid ${label}.` });
export const optUuid = (label: string) => z.preprocess(emptyToUndefined, z.uuid({ error: `Choose a valid ${label}.` }).optional());

export const enumOf = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `Choose a valid ${label}.` });

export const optEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.preprocess(emptyToUndefined, z.enum(values, { error: `Choose a valid ${label}.` }).optional());

/** Checkbox: present ("on"/"true") = true, absent = false. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Non-negative money amount as a canonical 2-dp string. */
export const money = (label: string, { allowZero = true, max = 999_999_999_999 } = {}) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .refine(isDecimalString, `${label} must be a number, like 1500 or 1500.50.`)
    .refine((v) => (allowZero ? dec(v).gte(0) : dec(v).gt(0)), allowZero ? `${label} cannot be negative.` : `${label} must be greater than zero.`)
    .refine((v) => dec(v).lte(max), `${label} is too large.`)
    .transform((v) => moneyString(v));

export const optMoney = (label: string) => z.preprocess(emptyToUndefined, money(label).optional());

/** Positive quantity as a canonical 3-dp string. */
export const quantity = (label: string, { allowZero = false } = {}) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .refine(isDecimalString, `${label} must be a number.`)
    .refine((v) => (allowZero ? dec(v).gte(0) : dec(v).gt(0)), allowZero ? `${label} cannot be negative.` : `${label} must be greater than zero.`)
    .refine((v) => dec(v).lte(9_999_999_999), `${label} is too large.`)
    .transform((v) => qtyString(v));

/** One or many ids submitted under the same field name. */
export const idList = (max = 10) =>
  z.preprocess(
    (v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v.filter((x) => x !== "") : [v]),
    z.array(z.uuid()).max(max, `You can attach up to ${max} files.`),
  );

export const slug = z
  .string({ error: "Web address name is required." })
  .trim()
  .min(1, "Web address name is required.")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens only, e.g. oak-dining-table.");
