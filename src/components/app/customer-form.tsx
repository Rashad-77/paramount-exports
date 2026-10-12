import { ActionForm, DuplicateConfirm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

export interface CustomerFormValues {
  id?: string;
  name?: string;
  company?: string | null;
  phone?: string;
  email?: string | null;
  address?: string | null;
  preferredContact?: string | null;
  notes?: string | null;
}

export function CustomerForm({ action, values = {}, submitLabel }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; values?: CustomerFormValues; submitLabel: string }) {
  return (
    <ActionForm action={action}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" label="Name" required defaultValue={values.name} autoComplete="off" />
        <FField name="company" label="Company" defaultValue={values.company ?? ""} />
        <FField name="phone" label="Phone number" type="tel" required defaultValue={values.phone} />
        <FField name="email" label="Email" type="email" defaultValue={values.email ?? ""} />
        <FSelect name="preferredContact" label="Preferred contact" defaultValue={values.preferredContact ?? ""} placeholder="No preference" options={[{ value: "phone", label: "Phone call" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }]} />
      </div>
      <FTextArea name="address" label="Address" rows={2} defaultValue={values.address ?? ""} />
      <FTextArea name="notes" label="Notes" rows={3} defaultValue={values.notes ?? ""} />
      <DuplicateConfirm />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
