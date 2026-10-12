import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { LEAD_KIND_LABEL, LEAD_SOURCES, LEAD_SOURCE_LABEL } from "@/lib/crm";
import { listAssignableStaff } from "@/server/leads";
import { createLeadAction } from "../crm-actions";

export const metadata = { title: "Record enquiry" };

export default async function NewLeadPage() {
  const actor = await requireActor();
  requirePermission(actor, "leads:write");
  const staff = await listAssignableStaff(actor);
  return (
    <>
      <PageHeader title="Record an enquiry" description="For enquiries that did not come through the website: phone calls, WhatsApp, showroom visits, referrals." />
      <Panel>
        <ActionForm action={createLeadAction}>
          <div className="grid gap-5 md:grid-cols-2">
            <FSelect name="source" label="How did they get in touch?" required defaultValue="phone" options={LEAD_SOURCES.filter((s) => s !== "website").map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] }))} />
            <FSelect name="kind" label="Type" required defaultValue="general" options={Object.entries(LEAD_KIND_LABEL).map(([value, label]) => ({ value, label }))} />
            <FField name="name" label="Contact name" required />
            <FField name="phone" label="Phone number" type="tel" required />
            <FField name="email" label="Email" type="email" />
            <FSelect name="preferredContact" label="Preferred contact" placeholder="No preference" options={[{ value: "phone", label: "Phone call" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }]} />
            {can(actor, "leads:assign") ? <FSelect name="assignedTo" label="Assign to" defaultValue={actor.id} options={staff.map((s) => ({ value: s.id, label: s.name }))} /> : null}
          </div>
          <FTextArea name="message" label="What do they want?" rows={4} />
          <FileUploader purpose="lead_attachment" label="Photos or sketches they sent" accept="image/jpeg,image/png,image/webp,application/pdf" />
          <SubmitButton>Save enquiry</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
