import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getSettingsForAdmin } from "@/server/settings";
import { listAssignableStaff } from "@/server/leads";
import { updateBusinessAction, updateCrmAction, updateProductionAction, updateSalesAction } from "./actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await requireActor();
  const { business, crm, sales, production } = await getSettingsForAdmin(actor);
  const canManage = can(actor, "settings:manage");
  const staff = canManage ? await listAssignableStaff(actor) : [];
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

        {canManage ? (
          <Panel title="Discount limit for Sales staff" description="Sales staff can discount a quotation line up to this percentage of its value. Anything higher needs a Manager or the Owner. Starts at 0 until you set it.">
            <ActionForm action={updateSalesAction}>
              <FField name="maxDiscountPercent" label="Maximum discount (%)" inputMode="decimal" defaultValue={sales.maxDiscountPercent} required className="max-w-xs" />
              <SubmitButton>Save discount limit</SubmitButton>
            </ActionForm>
          </Panel>
        ) : null}

        {canManage ? (
          <Panel title="Workshop" description="Optional workflows. Both start switched off; the workshop works without them.">
            <ActionForm action={updateProductionAction}>
              <FCheckbox name="createsFinishedStock" label="Add finished custom pieces to stock" hint="When a job reaches “Ready for delivery” the finished piece is added to the workshop stock, and taken out again when the order is delivered. Applies to jobs created from now on." defaultChecked={production.createsFinishedStock} />
              <FCheckbox name="trackLabour" label="Record labour cost on jobs" hint="Adds a labour panel for managers and finance. Direct labour only — payroll is not part of this system." defaultChecked={production.trackLabour} />
              <SubmitButton>Save workshop settings</SubmitButton>
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
