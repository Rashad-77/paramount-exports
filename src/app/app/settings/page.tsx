import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { DEFAULT_ABOUT, DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/lib/default-pages";
import { getSettingsForAdmin } from "@/server/settings";
import { listAssignableStaff } from "@/server/leads";
import { updateBusinessAction, updateCrmAction, updatePagesAction } from "./actions";

export const metadata = { title: "Business & pages" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const { business, pages, crm } = await getSettingsForAdmin(actor);
  const canManage = can(actor, "settings:manage");
  const canPages = can(actor, "website:manage");
  const staff = canManage ? await listAssignableStaff(actor) : [];
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <PageHeader title="Business & pages" description="Details shown on the website and on documents, and the wording of the About, Privacy and Terms pages." />
      <div className="space-y-6">
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
                {Object.entries({ Name: business.name, Telephone: business.phone, WhatsApp: business.whatsapp, Email: business.email, Address: business.address, Hours: business.openingHours, Currency: business.currency, Timezone: business.timezone }).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-text-muted">{k}</dt>
                    <dd className="whitespace-pre-line font-medium">{v ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Panel>

        {canPages ? (
          <Panel title="Page content" description="Plain text. Separate paragraphs with a blank line; start a line with ## for a heading and with - for a bullet. Leave blank to show the draft text.">
            <ActionForm action={updatePagesAction}>
              <FTextArea name="about" label="About & craftsmanship" rows={8} defaultValue={pages.about ?? ""} placeholder={DEFAULT_ABOUT} />
              <FTextArea name="privacy" label="Privacy notice" rows={12} defaultValue={pages.privacy ?? ""} placeholder={DEFAULT_PRIVACY.slice(0, 200) + "…"} hint="The draft text describes what this website really collects. Have your final notice reviewed before launch." />
              <FTextArea name="terms" label="Terms" rows={8} defaultValue={pages.terms ?? ""} placeholder={DEFAULT_TERMS.slice(0, 200) + "…"} />
              <SubmitButton>Save page content</SubmitButton>
            </ActionForm>
          </Panel>
        ) : null}

        {canManage ? (
          <Panel title="Website enquiries" description="Who new website enquiries are assigned to automatically.">
            <ActionForm action={updateCrmAction}>
              <FSelect name="defaultAssigneeId" label="Default assignee" defaultValue={crm.defaultAssigneeId ?? ""} placeholder="Leave unassigned" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
              <SubmitButton>Save</SubmitButton>
            </ActionForm>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
