import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { customerAuthMode } from "@/lib/auth/customer";
import { requireActor } from "@/lib/auth/session";
import { getSettingsForAdmin } from "@/server/settings";
import { updateAccountsAction, updateBusinessAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const { business, accounts } = await getSettingsForAdmin(actor);
  const authMode = customerAuthMode();
  const canManage = can(actor, "settings:manage");
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <ModuleHeader href="/app/settings" />
      <div className="min-w-0 space-y-6">
        <Panel title="Business details" description="Until a real business name is saved, the website shows placeholder content and asks search engines not to index it.">
          {canManage ? (
            <ActionForm action={updateBusinessAction}>
              <div className="grid gap-5 md:grid-cols-2">
                <FField name="name" label="Business name" defaultValue={business.name} required />
                <FField name="tagline" label="Short description" defaultValue={business.tagline ?? ""} hint="Shown under the name and in search results." />
                <FField name="phone" label="Telephone" type="tel" defaultValue={business.phone ?? ""} />
                <FField name="phoneAlt" label="Second telephone" type="tel" defaultValue={business.phoneAlt ?? ""} />
                <FField name="whatsapp" label="WhatsApp number" type="tel" defaultValue={business.whatsapp ?? ""} hint="Visitors can open a chat from the website." />
                <FField name="email" label="Email" type="email" defaultValue={business.email ?? ""} />
                <FField name="mapUrl" label="Map link" defaultValue={business.mapUrl ?? ""} hint="Only shown once an address is also entered." />
                <FField name="notifyEmail" label="Email for new orders" type="email" defaultValue={business.notifyEmail ?? ""} hint="The website emails this address when an order, quotation request or message arrives. Leave blank to use the business email." />
                <FField name="tiktok" label="TikTok link" defaultValue={business.tiktok ?? ""} hint="The full web address of your TikTok page. Shown in the website footer." />
                <FTextArea name="address" label="Showroom address" rows={3} defaultValue={business.address ?? ""} />
                <FTextArea name="openingHours" label="Opening hours" rows={3} defaultValue={business.openingHours ?? ""} hint="One line per day or range, e.g. Mon–Sat 9:00–18:00." />
                <FTextArea name="bankDetails" label="Bank details for transfers" rows={3} defaultValue={business.bankDetails ?? ""} hint="Shown to customers who choose to pay by bank transfer: account name, number and bank." />
                <FField name="currency" label="Currency code" defaultValue={business.currency} required hint="Assumed LKR — confirm with the owner." />
                <FSelect name="timezone" label="Timezone" defaultValue={business.timezone} options={timezones.map((z) => ({ value: z, label: z }))} required hint="Assumed Asia/Colombo — confirm." />
                <FField name="phoneCountryCode" label="Phone country code" defaultValue={business.phoneCountryCode} required hint="Used to build WhatsApp links from numbers starting with 0." />
              </div>
              <SubmitButton>Save business details</SubmitButton>
            </ActionForm>
          ) : (
            <>
              <Alert tone="info">Only the owner can change business details.</Alert>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                {Object.entries({ Name: business.name, Telephone: business.phone, WhatsApp: business.whatsapp, Email: business.email, Address: business.address, Hours: business.openingHours, "Bank details": business.bankDetails, Currency: business.currency, Timezone: business.timezone }).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-text-muted">{k}</dt>
                    <dd className="whitespace-pre-line font-medium">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Panel>
        <Panel
          title="Customer accounts"
          description="Let customers create an account to see their orders and quotation requests, save their details and keep their basket between devices. Guests can always track an order with its number and phone number."
        >
          {authMode === "off" ? (
            <Alert tone="warning" title="Sign-in service not connected">
              Accounts cannot be turned on until Supabase sign-in is connected to this website (the same service staff sign in with). Until then the website shows no sign-in for customers.
            </Alert>
          ) : authMode === "local" ? (
            <Alert tone="info" title="Development sign-in">
              This copy of the site uses a built-in test sign-in. The live website uses Supabase.
            </Alert>
          ) : (
            <Alert tone="success" title="Sign-in service connected">
              In your Supabase project, check that email sign-up is allowed and that the confirmation and password-reset emails are set up, and add this website&apos;s address to the allowed redirect URLs.
            </Alert>
          )}
          {canManage ? (
            <ActionForm action={updateAccountsAction} className="mt-5">
              <FCheckbox name="enabled" label="Turn on customer accounts" hint="Shows Sign in in the website header and the account pages." defaultChecked={accounts.enabled} />
              <FCheckbox name="allowSignUp" label="Let new customers create an account" hint="Turn off to let only existing accounts sign in." defaultChecked={accounts.allowSignUp} />
              <FCheckbox name="requiredForCheckout" label="Require an account to place an order" hint="Guests are sent to sign in or create an account at checkout. Leave off to keep guest checkout." defaultChecked={accounts.requiredForCheckout} />
              <FCheckbox name="saveCart" label="Keep a signed-in customer's basket on their account" hint="So it is still there on another phone or computer." defaultChecked={accounts.saveCart} />
              <SubmitButton>Save account options</SubmitButton>
            </ActionForm>
          ) : (
            <p className="mt-4 text-sm text-text-muted">Only the owner can change these options. Accounts are currently {accounts.enabled ? "on" : "off"}.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
