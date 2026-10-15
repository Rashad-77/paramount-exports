"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  changePasswordAction,
  claimOrderAction,
  deleteAccountAction,
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateProfileAction,
} from "@/app/(public)/account/actions";
import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { useFormToken } from "@/components/forms/use-form-token";
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

const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters.`;

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
      <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} hint="So we can call you about your orders." />
      <FField name="password" label="Password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} hint={PASSWORD_HINT} required />
      <FField name="confirmPassword" label="Type the password again" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      <FCheckbox name="consent" label="I agree that you keep my details to run my account." hint="Used only for my orders and enquiries. See the Privacy notice." />
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
      <FField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} hint={PASSWORD_HINT} required />
      <FField name="confirmPassword" label="Type it again" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      <SubmitButton size="cta">Save new password</SubmitButton>
    </ActionForm>
  );
}

export function ProfileForm({ fullName, email, phone, address }: { fullName: string; email: string; phone: string | null; address: string | null }) {
  return (
    <ActionForm action={updateProfileAction}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="fullName" label="Your name" autoComplete="name" maxLength={120} defaultValue={fullName} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} defaultValue={phone ?? ""} hint="Offered automatically when you place an order." />
      </div>
      <div>
        <p className="text-sm font-medium">Email</p>
        <p className="mt-1.5 text-sm text-text-muted">{email}</p>
      </div>
      <FTextArea name="address" label="Delivery address" rows={3} maxLength={400} autoComplete="street-address" defaultValue={address ?? ""} hint="Offered automatically when you choose delivery." />
      <SubmitButton>Save my details</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction}>
      <FField name="currentPassword" label="Current password" type="password" autoComplete="current-password" maxLength={200} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} hint={PASSWORD_HINT} required />
        <FField name="confirmPassword" label="Type it again" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
      </div>
      <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
    </ActionForm>
  );
}

export function DeleteForm() {
  return (
    <ActionForm action={deleteAccountAction}>
      <FField name="confirmEmail" label="Type your email address to confirm" type="email" autoComplete="off" inputMode="email" maxLength={200} required />
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete my account
      </SubmitButton>
    </ActionForm>
  );
}

export function ClaimOrderForm() {
  return (
    <ActionForm action={claimOrderAction}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="reference" label="Order number" placeholder="ORD-000123" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required hint="The number you gave when you ordered." />
      </div>
      <SubmitButton pendingLabel="Adding…">Add this order</SubmitButton>
    </ActionForm>
  );
}

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/quotations", label: "Quotations" },
  { href: "/account/settings", label: "Settings" },
];

export function AccountNav() {
  const path = usePathname();
  const current = TABS.filter((t) => (t.href === "/account" ? path === "/account" : path.startsWith(t.href))).at(-1)?.href;
  return (
    <nav aria-label="Your account" className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={
            "-mb-px border-b-2 px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] transition-colors " +
            (t.href === current ? "border-brand text-brand" : "border-transparent text-text-muted hover:text-text")
          }
        >
          {t.label}
        </Link>
      ))}
      <form action={signOutAction} className="ml-auto">
        <button type="submit" className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-text-muted hover:text-text">
          Sign out
        </button>
      </form>
    </nav>
  );
}
