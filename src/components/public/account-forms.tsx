"use client";

import { Heart, LayoutDashboard, LogOut, Package, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import {
  changePasswordAction,
  claimOrderAction,
  defaultAddressAction,
  deleteAccountAction,
  deleteAddressAction,
  forgotPasswordAction,
  resetPasswordAction,
  respondQuotationAction,
  saveAddressAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateProfileAction,
} from "@/app/(public)/account/actions";
import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/ui/field";
import { splitAddress } from "@/lib/address-lines";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { useFormToken } from "@/components/forms/use-form-token";
import { GlassSelect } from "@/components/public/glass-select";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/accounts";

const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
    <label>
      Leave this field empty
      <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
    </label>
  </div>
);


export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signInAction}>
      <Honeypot />
      <input type="hidden" name="next" value={next ?? ""} />
      <FField name="email" label="Email" type="email" autoComplete="username" inputMode="email" maxLength={200} required />
      <FField name="password" label="Password" type="password" autoComplete="current-password" maxLength={200} required />
      <SubmitButton size="cta" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-sm">
        <Link href="/account/forgot" className="text-text underline">
          Forgot your password?
        </Link>
      </p>
    </ActionForm>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const token = useFormToken();
  return (
    <ActionForm action={signUpAction}>
      <Honeypot />
      <input type="hidden" name="formToken" value={token} />
      <input type="hidden" name="next" value={next ?? ""} />
      <FField name="fullName" label="Your name" autoComplete="name" maxLength={120} required />
      <FField name="email" label="Email" type="email" autoComplete="email" inputMode="email" maxLength={200} required />
      <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} />
      <FField name="password" label="Password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required />
      <FField name="confirmPassword" label="Retype password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      <SubmitButton size="cta" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </ActionForm>
  );
}

export function ForgotForm() {
  return (
    <ActionForm action={forgotPasswordAction} hideOnSuccess successTitle="Check your email">
      <Honeypot />
      <FField name="email" label="Email" type="email" autoComplete="username" inputMode="email" maxLength={200} required />
      <SubmitButton size="cta" pendingLabel="Sending…">
        Send the link
      </SubmitButton>
    </ActionForm>
  );
}

export function ResetForm() {
  return (
    <ActionForm action={resetPasswordAction}>
      <FField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required />
      <FField name="confirmPassword" label="Retype password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      <SubmitButton size="cta">Save new password</SubmitButton>
    </ActionForm>
  );
}

export function ProfileForm({ fullName, email, phone }: { fullName: string; email: string; phone: string | null }) {
  return (
    <ActionForm action={updateProfileAction}>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FField name="fullName" label="Full name" autoComplete="name" maxLength={120} defaultValue={fullName} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} defaultValue={phone ?? ""} />
      </div>
      <TextField label="Email address" type="email" value={email} readOnly showOptional={false} />
      <SubmitButton size="cta">Save changes</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction}>
      <FField name="currentPassword" label="Current password" type="password" autoComplete="current-password" maxLength={200} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required />
        <FField name="confirmPassword" label="Retype password" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      </div>
      <SubmitButton size="cta" pendingLabel="Changing…">Change password</SubmitButton>
    </ActionForm>
  );
}

export function DeleteForm() {
  return (
    <ActionForm action={deleteAccountAction}>
      <FField name="confirmEmail" label="Type your email address to confirm" type="email" autoComplete="off" inputMode="email" maxLength={200} required />
      <ConfirmSubmit size="cta" variant="danger" title="Delete your account?" description="This removes your account, your saved details and your saved basket. You cannot undo this." confirmLabel="Delete my account">
        Delete my account
      </ConfirmSubmit>
    </ActionForm>
  );
}

export function ClaimOrderForm() {
  return (
    <ActionForm action={claimOrderAction}>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FField name="reference" label="Order number" placeholder="482719366" inputMode="numeric" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required />
      </div>
      <SubmitButton size="cta" pendingLabel="Adding…">
        Add this order
      </SubmitButton>
    </ActionForm>
  );
}

const TABS = [
  { href: "/account", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/account/profile", label: "Profile details", Icon: User },
  { href: "/account/orders", label: "My orders", Icon: Package },
  { href: "/account/wishlist", label: "My wishlist", Icon: Heart },
];

export function AccountNav() {
  const path = usePathname();
  const router = useRouter();
  const signOut = useRef<HTMLFormElement>(null);
  const current = TABS.filter((t) => (t.href === "/account" ? path === "/account" : path.startsWith(t.href))).at(-1)?.href;
  return (
    <>
    {/* Phones: one dropdown, the same bar as the collection filter */}
    <div className="acct-nav-select">
      <GlassSelect
        variant="bar"
        label="Your account"
        value={current ?? "/account"}
        options={[...TABS.map((t) => ({ value: t.href, label: t.label })), { value: "log-out", label: "Log out" }]}
        onChange={(v) => (v === "log-out" ? signOut.current?.requestSubmit() : router.push(v))}
      />
      <form ref={signOut} action={signOutAction} hidden />
    </div>
    <nav aria-label="Your account" className="acct-nav">
      {TABS.map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>
          <Icon aria-hidden="true" strokeWidth={1.5} />
          {label}
        </Link>
      ))}
      <form action={signOutAction} className="acct-signout">
        <button type="submit">
          <LogOut aria-hidden="true" strokeWidth={1.5} />
          Log out
        </button>
      </form>
    </nav>
    </>
  );
}

/** Accept or decline the price on a quotation. Declining asks for an optional reason; both are final, so each asks first. */
export function QuotationResponse({ reference, amount }: { reference: string; amount: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={respondQuotationAction}>
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="decision" value="accept" />
        <p className="acct-lead">Happy with the price? Accept it and we will contact you to confirm your order.</p>
        <ConfirmSubmit variant="primary" title="Accept this quotation?" description={`You are accepting the price of ${amount}. We will then contact you to confirm your order.`} confirmLabel="Accept quotation" destructive={false}>
          Accept quotation
        </ConfirmSubmit>
      </ActionForm>
      <ActionForm action={respondQuotationAction}>
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="decision" value="decline" />
        <FTextArea name="reason" label="Why are you declining?" rows={2} maxLength={500} />
        <ConfirmSubmit variant="secondary" title="Decline this quotation?" description="This closes the quotation. You can always send us a new request." confirmLabel="Decline quotation" destructive>
          Decline quotation
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}

/** Add or edit a saved address. */
export function AddressForm({ address, cancelHref, inline = false }: { address?: { id: string; address: string }; cancelHref?: string; inline?: boolean }) {
  const lines = address ? splitAddress(address.address) : undefined;
  return (
    <ActionForm key={address?.id ?? "new"} action={saveAddressAction}>
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <FField name="line1" label="Address line 1" autoComplete="address-line1" maxLength={120} defaultValue={lines?.line1} required />
      <FField name="line2" label="Address line 2" autoComplete="address-line2" maxLength={120} defaultValue={lines?.line2} />
      <FField name="line3" label="Address line 3" autoComplete="address-line3" maxLength={120} defaultValue={lines?.line3} />
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <FField name="city" label="City" autoComplete="address-level2" maxLength={80} defaultValue={lines?.city} required />
        <FField name="postalCode" label="Postal code" autoComplete="postal-code" maxLength={20} defaultValue={lines?.postalCode} required />
      </div>
      <div className={inline ? "acct-actions" : "flex flex-wrap items-center gap-4"}>
        {cancelHref ? (
          <Link href={cancelHref} className="acct-link">
            Cancel
          </Link>
        ) : null}
        <SubmitButton size="cta">{inline ? "Save" : "Save address"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Make an address the default, or delete it. */
export function AddressActions({ id, isDefault, label }: { id: string; isDefault: boolean; label: string }) {
  return (
    <div className="acct-actions">
      <Link href={`/account/profile?edit=${id}#address-form`} className="acct-link">
        Edit
      </Link>
      {isDefault ? null : (
        <ActionForm action={defaultAddressAction} className="space-y-0">
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="acct-link">
            Make default
          </button>
        </ActionForm>
      )}
      <ActionForm action={deleteAddressAction} className="space-y-0">
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmit variant="ghost" title="Delete this address?" description={`“${label}” will be removed from your account.`} confirmLabel="Delete address" destructive>
          Delete
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}
