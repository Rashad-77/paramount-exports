import type { Metadata } from "next";
import { ProfileForm } from "@/components/public/account-forms";
import { SectionHead } from "@/components/public/account-ui";
import { requireCustomer } from "@/lib/auth/customer";

export const metadata: Metadata = { title: "My Profile" };

export default async function AccountProfilePage() {
  const customer = await requireCustomer("/account/profile");
  return (
    <section aria-labelledby="profile-title" className="acct-card">
      <SectionHead id="profile-title" title="My profile" />
      <p className="acct-lead mb-6">These details are filled in for you when you place an order or ask for a quotation. To change your password, go to Password &amp; Security.</p>
      <ProfileForm fullName={customer.fullName} email={customer.email} phone={customer.phone} />
    </section>
  );
}
