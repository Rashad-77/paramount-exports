import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getSettingsForAdmin } from "@/server/settings";
import { updateBusinessAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const { business } = await getSettingsForAdmin(actor);
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
                <FField name="whatsapp" label="WhatsApp number" type="tel" defaultValue={business.whatsapp ?? ""} hint="Visitors can open a chat from the website." />
                <FField name="email" label="Email" type="email" defaultValue={business.email ?? ""} />
                <FField name="mapUrl" label="Map link" defaultValue={business.mapUrl ?? ""} hint="Only shown once an address is also entered." />
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
      </div>
    </>
  );
}
