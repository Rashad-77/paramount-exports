import type { Metadata } from "next";
import { DeleteForm, PasswordForm } from "@/components/public/account-forms";
import { SectionHead } from "@/components/public/account-ui";
import { signOutAction } from "@/app/(public)/account/actions";
import { customerAuthMode, requireCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "Password & Security" };

export default async function AccountSecurityPage() {
  await requireCustomer("/account/security");
  const canChangePassword = customerAuthMode() !== "off";
  return (
    <>
      {canChangePassword ? (
        <section aria-labelledby="password-title" className="acct-card">
          <SectionHead id="password-title" title="Change password" />
          <PasswordForm />
        </section>
      ) : null}

      <section aria-labelledby="signout-title" className="acct-card">
        <SectionHead id="signout-title" title="Log out" />
        <p className="acct-lead mb-5">Signing out ends this session on this device. Do this on a shared or public computer.</p>
        <form action={signOutAction}>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-[3px] border border-walnut px-7 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-walnut hover:bg-walnut hover:text-ivory">
            Log out
          </button>
        </form>
      </section>

      <section aria-labelledby="delete-title" className="acct-card">
        <SectionHead id="delete-title" title="Delete my account" />
        <p className="acct-lead mb-5">
          This removes your account, your saved details and your saved basket. Orders and requests you have already sent stay with us so we can finish them, but they are no longer linked to you. You cannot undo this.
        </p>
        <DeleteForm />
      </section>
    </>
  );
}
