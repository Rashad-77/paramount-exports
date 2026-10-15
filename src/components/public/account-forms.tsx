"use client";

import { Heart, LayoutDashboard, LogOut, MapPin, Package, ShieldCheck, User, FileText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { ActionForm, FCheckbox, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
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

export function ProfileForm({ fullName, email, phone }: { fullName: string; email: string; phone: string | null }) {
  return (
    <ActionForm action={updateProfileAction}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="fullName" label="Full name" autoComplete="name" maxLength={120} defaultValue={fullName} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} defaultValue={phone ?? ""} hint="Offered automatically when you place an order." />
      </div>
      <dl className="acct-details">
        <div>
          <dt>Email address</dt>
          <dd>{email}</dd>
        </div>
      </dl>
      <SubmitButton size="cta">Save changes</SubmitButton>
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
        <FField name="reference" label="Order number" placeholder="000123" inputMode="numeric" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={30} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required hint="The number you gave when you ordered." />
      </div>
      <SubmitButton pendingLabel="Adding…">Add this order</SubmitButton>
    </ActionForm>
  );
}

const TABS = [
  { href: "/account", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/account/quotations", label: "My Quotations", Icon: FileText },
  { href: "/account/orders", label: "My Orders", Icon: Package },
  { href: "/account/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/account/profile", label: "My Profile", Icon: User },
  { href: "/account/addresses", label: "My Addresses", Icon: MapPin },
  { href: "/account/security", label: "Password & Security", Icon: ShieldCheck },
];

export function AccountNav() {
  const path = usePathname();
  const current = TABS.filter((t) => (t.href === "/account" ? path === "/account" : path.startsWith(t.href))).at(-1)?.href;
  return (
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
        <FTextArea name="reason" label="Why are you declining?" rows={2} maxLength={500} hint="This helps us, but you do not have to say." />
        <ConfirmSubmit variant="secondary" title="Decline this quotation?" description="This closes the quotation. You can always send us a new request." confirmLabel="Decline quotation" destructive>
          Decline quotation
        </ConfirmSubmit>
      </ActionForm>
    </div>
  );
}

/** Add or edit a saved address. */
export function AddressForm({ address, cancelHref }: { address?: { id: string; label: string; recipient: string; phone: string | null; address: string; isDefault: boolean }; cancelHref?: string }) {
  return (
    <ActionForm key={address?.id ?? "new"} action={saveAddressAction}>
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <FField name="label" label="Address name" placeholder="e.g. Home, Office" maxLength={40} defaultValue={address?.label} required />
        <FField name="recipient" label="Name of the person receiving it" autoComplete="name" maxLength={120} defaultValue={address?.recipient} required />
      </div>
      <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} defaultValue={address?.phone ?? ""} hint="So the driver can reach whoever is receiving it." />
      <FTextArea name="address" label="Full address" rows={4} maxLength={400} autoComplete="street-address" defaultValue={address?.address} hint="House number, street, town and any landmark." required />
      <FCheckbox name="isDefault" label="Use this as my default delivery address" defaultChecked={address?.isDefault} />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton size="cta">{address ? "Save changes" : "Save address"}</SubmitButton>
        {cancelHref ? (
          <Link href={cancelHref} className="acct-link">
            Cancel
          </Link>
        ) : null}
      </div>
    </ActionForm>
  );
}

/** Make an address the default, or delete it. */
export function AddressActions({ id, isDefault, label }: { id: string; isDefault: boolean; label: string }) {
  return (
    <div className="acct-actions">
      <Link href={`/account/addresses?edit=${id}`} className="acct-link">
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
