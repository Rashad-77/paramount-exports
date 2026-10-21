import {
  ActionForm,
  FField,
  FSelect,
  FTextArea,
  SubmitButton,
} from "@/components/forms/action-form";
import { SettingRow } from "@/components/app/setting-row";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { Table, TableWrap } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getSettingsForAdmin } from "@/server/settings";
import { googleKeyIsSet } from "@/server/google-reviews";
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
        <Panel
          title="Business details"
          description="Until a real business name is saved, the website shows placeholder content and asks search engines not to index it."
        >
          {canManage ? (
            <ActionForm action={updateBusinessAction}>
              <TableWrap label="Business details">
                <Table className="table-fixed">
                  <tbody>
                    <SettingRow label="Business name" required>
                      <FField
                        name="name"
                        kind="title"
                        label="Business name"
                        defaultValue={business.name}
                        required
                      />
                    </SettingRow>
                    <SettingRow label="Short description">
                      <FField
                        name="tagline"
                        kind="title"
                        label="Short description"
                        defaultValue={business.tagline ?? ""}
                        hint="Shown under the name and in search results."
                      />
                    </SettingRow>
                    <SettingRow label="Telephone">
                      <FField
                        name="phone"
                        label="Telephone"
                        kind="phone"
                        defaultValue={business.phone ?? ""}
                      />
                    </SettingRow>
                    <SettingRow label="Second telephone">
                      <FField
                        name="phoneAlt"
                        label="Second telephone"
                        kind="phone"
                        defaultValue={business.phoneAlt ?? ""}
                      />
                    </SettingRow>
                    <SettingRow label="WhatsApp number">
                      <FField
                        name="whatsapp"
                        label="WhatsApp number"
                        kind="phone"
                        defaultValue={business.whatsapp ?? ""}
                        hint="Visitors can open a chat from the website."
                      />
                    </SettingRow>
                    <SettingRow label="Email">
                      <FField
                        name="email"
                        kind="email"
                        label="Email"
                        type="email"
                        defaultValue={business.email ?? ""}
                      />
                    </SettingRow>
                    <SettingRow label="Email for new orders">
                      <FField
                        name="notifyEmail"
                        kind="email"
                        label="Email for new orders"
                        type="email"
                        defaultValue={business.notifyEmail ?? ""}
                        hint="The website emails this address when an order, quotation request or message arrives. Leave blank to use the business email."
                      />
                    </SettingRow>
                    <SettingRow label="Map link">
                      <FField
                        name="mapUrl"
                        kind="url"
                        label="Map link"
                        defaultValue={business.mapUrl ?? ""}
                        hint="Only shown once an address is also entered."
                      />
                    </SettingRow>
                    <SettingRow label="Facebook link">
                      <FField
                        name="facebook"
                        kind="url"
                        label="Facebook link"
                        defaultValue={business.facebook ?? ""}
                        hint="The full web address of your Facebook page. Shown in the website footer."
                      />
                    </SettingRow>
                    <SettingRow label="TikTok link">
                      <FField
                        name="tiktok"
                        kind="url"
                        label="TikTok link"
                        defaultValue={business.tiktok ?? ""}
                        hint="The full web address of your TikTok page. Shown in the website footer."
                      />
                    </SettingRow>
                    <SettingRow label="Google Place ID">
                      <FField
                        name="googlePlaceId"
                        label="Google Place ID"
                        defaultValue={business.googlePlaceId ?? ""}
                        placeholder="ChIJ…"
                        hint={`Makes the Review us on Google button work and finds your Google reviews. Leave blank to switch both off. ${googleKeyIsSet() ? "Reviews are connected." : "To show the reviews as well, the Google API key still has to be added to the website's environment settings."}`}
                      />
                    </SettingRow>
                    <SettingRow label="Google review link">
                      <FField
                        name="googleReviewUrl"
                        kind="url"
                        label="Google review link"
                        defaultValue={business.googleReviewUrl ?? ""}
                        hint="Optional. The review link from your Google Business Profile, used for the button when there is no Place ID."
                      />
                    </SettingRow>
                    <SettingRow label="Showroom address">
                      <FTextArea
                        name="address"
                        kind="address"
                        label="Showroom address"
                        rows={3}
                        defaultValue={business.address ?? ""}
                      />
                    </SettingRow>
                    <SettingRow label="Opening hours">
                      <FTextArea
                        name="openingHours"
                        label="Opening hours"
                        rows={3}
                        defaultValue={business.openingHours ?? ""}
                        hint="One line per day or range, e.g. Mon–Sat 9:00–18:00."
                      />
                    </SettingRow>
                    <SettingRow label="Bank details for transfers">
                      <FTextArea
                        name="bankDetails"
                        label="Bank details for transfers"
                        rows={3}
                        defaultValue={business.bankDetails ?? ""}
                        hint="Shown to customers who choose to pay by bank transfer: account name, number and bank."
                      />
                    </SettingRow>
                    <SettingRow label="Currency code" required>
                      <FField
                        name="currency"
                        kind="currency"
                        label="Currency code"
                        defaultValue={business.currency}
                        required
                      />
                    </SettingRow>
                    <SettingRow label="Timezone" required>
                      <FSelect
                        name="timezone"
                        label="Timezone"
                        defaultValue={business.timezone}
                        options={timezones.map((z) => ({ value: z, label: z }))}
                        required
                      />
                    </SettingRow>
                    <SettingRow label="Phone country code" required>
                      <FField
                        name="phoneCountryCode"
                        kind="countryCode"
                        label="Phone country code"
                        defaultValue={`+${business.phoneCountryCode}`}
                        required
                        hint="Used to build WhatsApp links from numbers starting with 0."
                      />
                    </SettingRow>
                  </tbody>
                </Table>
              </TableWrap>
              <SubmitButton>Save business details</SubmitButton>
            </ActionForm>
          ) : (
            <>
              <Alert tone="info">
                Only the owner can change business details.
              </Alert>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                {Object.entries({
                  Name: business.name,
                  Telephone: business.phone,
                  WhatsApp: business.whatsapp,
                  Email: business.email,
                  Address: business.address,
                  Hours: business.openingHours,
                  "Bank details": business.bankDetails,
                  Currency: business.currency,
                  Timezone: business.timezone,
                }).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-text-muted">{k}</dt>
                    <dd className="whitespace-pre-line font-medium">
                      {v ?? "—"}
                    </dd>
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
