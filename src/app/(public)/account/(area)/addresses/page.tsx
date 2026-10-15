import type { Metadata } from "next";
import { AddressActions, AddressForm } from "@/components/public/account-forms";
import { Pill, SectionHead } from "@/components/public/account-ui";
import { Alert } from "@/components/ui/status";
import { requireCustomer } from "@/lib/auth/customer";
import { one, type SP } from "@/lib/list-params";
import { listAddresses } from "@/server/accounts";

export const metadata: Metadata = { title: "My Addresses" };

export default async function AccountAddressesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const customer = await requireCustomer("/account/addresses");
  const sp = await searchParams;
  const [addresses] = await Promise.all([listAddresses(customer.id)]);
  const editId = one(sp.edit);
  const editing = editId ? addresses.find((a) => a.id === editId) : undefined;
  const notice = one(sp.notice);
  return (
    <>
      {notice === "saved" ? <Alert tone="success">Your address is saved.</Alert> : null}
      {notice === "deleted" ? <Alert tone="success">The address has been deleted.</Alert> : null}

      <section aria-labelledby="addr-title" className="acct-card">
        <SectionHead id="addr-title" title="My addresses" />
        {addresses.length === 0 ? (
          <p className="acct-lead">You have no saved addresses yet. Save one below and it will be offered when you choose delivery.</p>
        ) : (
          <ul className="acct-grid">
            {addresses.map((a) => (
              <li key={a.id} className="acct-address" data-default={a.isDefault ? "" : undefined}>
                {a.isDefault ? <Pill tone="success">Default delivery address</Pill> : null}
                <strong className="text-[0.9375rem]">{a.label}</strong>
                <address>
                  {a.recipient}
                  {"\n"}
                  {a.address}
                  {a.phone ? `\n${a.phone}` : ""}
                </address>
                <AddressActions id={a.id} isDefault={a.isDefault} label={a.label} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="form-title" className="acct-card" id="address-form">
        <SectionHead id="form-title" title={editing ? `Edit “${editing.label}”` : "Add an address"} />
        <AddressForm address={editing} cancelHref={editing ? "/account/addresses" : undefined} />
      </section>
    </>
  );
}
