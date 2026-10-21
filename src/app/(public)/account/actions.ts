"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { runAction } from "@/lib/actions";
import {
  activeCustomer,
  customerAuthMode,
  changeCustomerPassword,
  deleteCustomerAccount,
  requestPasswordReset,
  setPasswordAfterReset,
  signInCustomer,
  signOutCustomer,
  signUpCustomer,
} from "@/lib/auth/customer";
import { getDb } from "@/lib/db/client";
import { rateLimited, unauthenticated, validation } from "@/lib/errors";
import { checkFormToken, HONEYPOT_FIELD } from "@/lib/form-guard";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { quotationResponseSchema } from "@/lib/schemas/quotations";
import { joinAddress } from "@/lib/address-lines";
import { addressIdSchema, addressSchema, avatarSchema, claimOrderSchema, deleteAccountSchema, forgotSchema, passwordChangeSchema, profileSchema, resetSchema, savedCartSchema, signInSchema, signUpSchema, type SavedCartItem } from "@/lib/schemas/accounts";
import { getAccountSettings } from "@/lib/settings";
import { removeAvatar, setAvatar } from "@/server/avatars";
import { claimOrder, deleteAddress, getSavedCart, respondToQuotation, saveAddress, saveCart, setDefaultAddress, toggleWishlist, updateProfile } from "@/server/accounts";
import { z } from "zod";

/** Only paths inside this website: never a full address (prevents being sent to another site after signing in). */
export async function safeNext(next: string | undefined, fallback = "/account"): Promise<string> {
  return next && /^\/(?!\/)[A-Za-z0-9\-_/]*$/.test(next) ? next : fallback;
}

async function accountsOn() {
  const s = await getAccountSettings();
  if (!s.enabled || customerAuthMode() === "off") throw validation("Customer accounts are not switched on.");
  return s;
}

async function signedIn() {
  await accountsOn();
  const customer = await activeCustomer();
  if (!customer) throw unauthenticated("Your session has ended. Please sign in again.");
  return customer;
}

async function throttle(scope: string, value: string, limit: number, windowSeconds: number, message: string) {
  let allowed: boolean;
  try {
    allowed = (await hitRateLimit(getDb(), { scope, value, limit, windowSeconds })).allowed;
  } catch (e) {
    // If the limiter itself is down, refuse rather than allow unlimited guessing.
    console.error("Account rate limit unavailable", e instanceof Error ? e.message : e);
    throw validation("This is temporarily unavailable. Please try again shortly.");
  }
  if (!allowed) throw rateLimited(message);
}

export async function signUpAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    signUpSchema,
    async (input, ctx) => {
      const settings = await accountsOn();
      if (!settings.allowSignUp) throw validation("New accounts are not being created at the moment. Please contact us.");
      if (input[HONEYPOT_FIELD]) return { redirectTo: "/account/sign-in" };
      const token = checkFormToken(input.formToken);
      if (token === "too-fast") throw validation("That was very quick. Please check your details and try again.");
      if (token !== "ok") throw validation("This form has expired. Please reload the page and try again.");
      const ip = clientIp(ctx.headers);
      await throttle("account-signup-ip", ip ?? "unknown", 6, 3600, "Several accounts were created from this connection recently. Please try again later.");
      const result = await signUpCustomer({ fullName: input.fullName, email: input.email, password: input.password, phone: input.phone });
      if (result === "confirm-email") {
        return { redirectTo: `/account/sign-in?notice=check-email` };
      }
      revalidatePath("/", "layout");
      return { redirectTo: await safeNext(input.next) };
    },
    { public: true },
  );
}

export async function signInAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    signInSchema,
    async (input, ctx) => {
      await accountsOn();
      if (input[HONEYPOT_FIELD]) return { redirectTo: "/account/sign-in" };
      const ip = clientIp(ctx.headers);
      await throttle("account-login-email", input.email.toLowerCase(), 8, 600, "Too many sign-in attempts. Please wait a few minutes and try again.");
      await throttle("account-login-ip", ip ?? "unknown", 30, 600, "Too many sign-in attempts. Please wait a few minutes and try again.");
      await signInCustomer({ email: input.email, password: input.password });
      revalidatePath("/", "layout");
      return { redirectTo: await safeNext(input.next) };
    },
    { public: true },
  );
}

export async function signOutAction(): Promise<void> {
  await signOutCustomer();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    forgotSchema,
    async (input, ctx) => {
      await accountsOn();
      if (!input[HONEYPOT_FIELD]) {
        await throttle("account-forgot-ip", clientIp(ctx.headers) ?? "unknown", 6, 3600, "Too many requests. Please try again later.");
        await requestPasswordReset(input.email);
      }
      // The same answer whether or not the address has an account.
      return { message: "If there is an account for that email address, we have sent a link to choose a new password." };
    },
    { public: true },
  );
}

export async function resetPasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    resetSchema,
    async (input) => {
      await accountsOn();
      await setPasswordAfterReset(input.newPassword);
      return { redirectTo: "/account?notice=password-changed" };
    },
    { public: true },
  );
}

export async function updateProfileAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    profileSchema,
    async (input) => {
      const customer = await signedIn();
      await updateProfile(customer.id, input);
      revalidatePath("/account", "layout");
      return { message: "Your details are saved." };
    },
    { public: true },
  );
}

export async function setAvatarAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    avatarSchema,
    async (input) => {
      const customer = await signedIn();
      await setAvatar(customer.id, input.fileIds[0]!);
      revalidatePath("/account", "layout");
      revalidatePath("/");
      return { message: "Your profile picture is saved." };
    },
    { public: true },
  );
}

export async function removeAvatarAction(_p: ActionState, _fd: FormData): Promise<ActionState> {
  return runAction(
    _fd,
    z.object({}),
    async () => {
      const customer = await signedIn();
      await removeAvatar(customer.id);
      revalidatePath("/account", "layout");
      revalidatePath("/");
      return { message: "Your profile picture is removed." };
    },
    { public: true },
  );
}

export async function changePasswordAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    passwordChangeSchema,
    async (input) => {
      const customer = await signedIn();
      await throttle("account-password", customer.id, 8, 3600, "Too many attempts. Please wait a while and try again.");
      await changeCustomerPassword(customer, input.currentPassword, input.newPassword);
      return { message: "Your password has been changed." };
    },
    { public: true },
  );
}

export async function deleteAccountAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    deleteAccountSchema,
    async (input) => {
      const customer = await signedIn();
      if (input.confirmEmail.toLowerCase() !== customer.email.toLowerCase()) {
        throw validation("That is not the email address on this account.", { confirmEmail: ["Type the email address of this account exactly."] });
      }
      await deleteCustomerAccount(customer);
      revalidatePath("/", "layout");
      return { redirectTo: "/?notice=account-deleted" };
    },
    { public: true },
  );
}

export async function claimOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    claimOrderSchema,
    async (input) => {
      const customer = await signedIn();
      const { reference } = await claimOrder(customer.id, input);
      revalidatePath("/account", "layout");
      return { message: `Order ${reference} has been added to your account.` };
    },
    { public: true },
  );
}

/** The saved basket, read when a customer signs in on a new device. Empty when they have none or saving is off. */
export async function loadSavedCartAction(): Promise<SavedCartItem[]> {
  const settings = await getAccountSettings();
  const customer = await activeCustomer();
  if (!settings.enabled || !settings.saveCart || !customer) return [];
  return getSavedCart(customer.id);
}

/** Store the basket on the account. Called quietly by the browser whenever the basket changes while signed in. */
export async function saveCartAction(items: unknown): Promise<{ ok: boolean }> {
  const settings = await getAccountSettings();
  const customer = await activeCustomer();
  if (!settings.enabled || !settings.saveCart || !customer) return { ok: false };
  const parsed = z.unknown().pipe(savedCartSchema).safeParse(items);
  if (!parsed.success) return { ok: false };
  await saveCart(customer.id, parsed.data);
  return { ok: true };
}

/** The customer accepts or declines the price on one of their own quotations. */
export async function respondQuotationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    quotationResponseSchema,
    async (input) => {
      const customer = await signedIn();
      await respondToQuotation(customer.id, input.reference, input.decision, input.reason);
      revalidatePath("/account", "layout");
      return { message: input.decision === "accept" ? "Thank you. You have accepted the quotation, and we will contact you to confirm your order." : "You have declined the quotation. If you change your mind, just contact us." };
    },
    { public: true },
  );
}

export async function saveAddressAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    addressSchema,
    async (input) => {
      const customer = await signedIn();
      await saveAddress(customer.id, {
        id: input.id,
        label: input.city,
        recipient: customer.fullName,
        phone: customer.phone ?? undefined,
        address: joinAddress({ line1: input.line1, line2: input.line2 ?? "", line3: input.line3 ?? "", city: input.city, postalCode: input.postalCode }),
        isDefault: false,
      });
      revalidatePath("/account", "layout");
      return { redirectTo: "/account/profile?notice=saved" };
    },
    { public: true },
  );
}

export async function defaultAddressAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    addressIdSchema,
    async (input) => {
      const customer = await signedIn();
      await setDefaultAddress(customer.id, input.id);
      revalidatePath("/account", "layout");
      return { message: "That is now your default delivery address." };
    },
    { public: true },
  );
}

export async function deleteAddressAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    fd,
    addressIdSchema,
    async (input) => {
      const customer = await signedIn();
      await deleteAddress(customer.id, input.id);
      revalidatePath("/account", "layout");
      return { redirectTo: "/account/profile?notice=deleted" };
    },
    { public: true },
  );
}

/** Save or remove a product from the wishlist. For the heart button, which needs a plain answer, not a form message. */
export async function toggleWishlistAction(productId: string): Promise<{ saved: boolean } | { error: string }> {
  try {
    const settings = await getAccountSettings();
    const customer = await activeCustomer();
    if (!settings.enabled || !customer) return { error: "Please sign in to save products." };
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return { error: "That product could not be saved." };
    await throttle("account-wishlist", customer.id, 120, 3600, "You are saving products very quickly. Please wait a moment.");
    const saved = await toggleWishlist(customer.id, productId);
    revalidatePath("/account/wishlist");
    return { saved };
  } catch (e) {
    return { error: e instanceof Error && e.message ? e.message : "That could not be saved. Please try again." };
  }
}
