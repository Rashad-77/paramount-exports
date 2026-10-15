import type { Metadata } from "next";
import { DeleteForm, PasswordForm, ProfileForm } from "@/components/public/account-forms";
import { customerAuthMode, requireCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Settings" };

export default async function AccountSettingsPage() {
  const customer = await requireCustomer("/account/settings");
  const canChangePassword = customerAuthMode() !== "off";
  return (
    <div className="max-w-2xl space-y-10">
      <section aria-labelledby="details-title" className="soft-card">
        <h2 id="details-title" className="font-display mb-5 text-[1.5rem] leading-tight text-brand">
          Your details
        </h2>
        <ProfileForm fullName={customer.fullName} email={customer.email} phone={customer.phone} address={customer.address} />
      </section>

      {canChangePassword ? (
        <section aria-labelledby="password-title" className="soft-card">
          <h2 id="password-title" className="font-display mb-5 text-[1.5rem] leading-tight text-brand">
            Password
          </h2>
          <PasswordForm />
        </section>
      ) : null}

      <section aria-labelledby="delete-title" className="soft-card">
        <h2 id="delete-title" className="font-display text-[1.5rem] leading-tight text-brand">
          Delete my account
        </h2>
        <p className="mb-5 mt-2 text-sm text-text-muted">
          This removes your account, your saved details and your saved basket. Orders and requests you have already sent stay with us so we can finish them, but they are no longer linked to you. You can still track an order with its number and phone number.
        </p>
        <DeleteForm />
      </section>
    </div>
  );
}
