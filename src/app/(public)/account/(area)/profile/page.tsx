import type { Metadata } from "next";
import Link from "next/link";
import { AddressActions, AddressForm, AvatarForm, DeleteForm, PasswordForm, ProfileForm } from "@/components/public/account-forms";
import { Pill } from "@/components/public/account-ui";
import { ToastOnMount } from "@/components/ui/toaster";
import { customerAuthMode, requireCustomer } from "@/lib/auth/customer";
import { one, type SP } from "@/lib/list-params";
import { addressRows } from "@/lib/address-lines";
import { listAddresses } from "@/server/accounts";
import { avatarsFor } from "@/server/avatars";

export const metadata: Metadata = { title: "Profile Details" };

/** One container, top to bottom: name and phone, email, delivery addresses, password, delete account. */
export default async function AccountProfilePage({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await requireCustomer("/account/profile");
  const sp = await searchParams;
  const addresses = await listAddresses(customer.id);
  const avatar = (await avatarsFor([customer.id])).get(customer.id) ?? null;
  const editId = one(sp.edit);
  const editing = editId ? addresses.find((a) => a.id === editId) : undefined;
  const notice = one(sp.notice);
  const canChangePassword = customerAuthMode() !== "off";
  return (
    <>
      {notice === "saved" ? <ToastOnMount message="Your address is saved." /> : null}
      {notice === "deleted" ? <ToastOnMount message="The address has been deleted." /> : null}

      <section aria-label="Profile details" className="acct-card acct-stack">
        <div className="acct-part">
          <h2 className="acct-part-h">Details</h2>
          <ProfileForm fullName={customer.fullName} email={customer.email} phone={customer.phone} />
        </div>

        <div className="acct-part">
          <h2 className="acct-part-h">Profile picture</h2>
          <AvatarForm current={avatar} />
        </div>

        <div className="acct-part" id="address-form">
          <h2 className="acct-part-h">Delivery addresses</h2>
          {addresses.length > 0 ? (
            <ul className="acct-grid acct-grid-one">
              {addresses.map((a, i) => (
                <li key={a.id} className="acct-addr-item">
                  <p className="acct-addr-no">Address {i + 1}</p>
                  <div className="acct-address" data-default={a.isDefault ? "" : undefined} data-editing={editing?.id === a.id ? "" : undefined}>
                    {editing?.id === a.id ? (
                      <>
                        <h3 className="acct-sub-h">Edit “Address {i + 1}”</h3>
                        <AddressForm inline address={a} cancelHref="/account/profile" />
                      </>
                    ) : (
                      <>
                        {a.isDefault ? <Pill tone="success">Default</Pill> : null}
                        <address>{addressRows(a.address).join("\n")}</address>
                        <AddressActions id={a.id} isDefault={a.isDefault} label={a.label} />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {addresses.length > 0 ? (
            <details className="acct-add">
              <summary>Add another address</summary>
              <div className="acct-add-body">
                <AddressForm />
              </div>
            </details>
          ) : (
            <AddressForm />
          )}
        </div>

        {canChangePassword ? (
          <div className="acct-part">
            <div className="acct-part-top">
              <h2 id="password-title" className="acct-part-h">
                Change password
              </h2>
              <Link href="/account/forgot" className="acct-link">
                Forgot your password?
              </Link>
            </div>
            <PasswordForm />
          </div>
        ) : null}

        <div className="acct-part">
          <h2 id="delete-title" className="acct-part-h">
            Delete my account
          </h2>
          <p className="acct-lead mb-5">This removes your account, your saved details and your saved basket. You cannot undo this.</p>
          <DeleteForm />
        </div>
      </section>
    </>
  );
}
