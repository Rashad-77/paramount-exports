import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { saveSupplierAction } from "@/app/app/suppliers/actions";

export function SupplierForm({ initial }: { initial?: { id: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null; suppliedMaterials: string | null; notes: string | null } }) {
  return (
    <ActionForm action={saveSupplierAction}>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="name" label="Supplier name" required defaultValue={initial?.name ?? ""} />
        <FField name="contactName" label="Contact person" defaultValue={initial?.contactName ?? ""} />
        <FField name="phone" label="Phone" type="tel" defaultValue={initial?.phone ?? ""} />
        <FField name="email" label="Email" type="email" defaultValue={initial?.email ?? ""} />
        <FTextArea name="address" label="Address" rows={2} defaultValue={initial?.address ?? ""} />
        <FTextArea name="suppliedMaterials" label="Materials supplied" rows={2} defaultValue={initial?.suppliedMaterials ?? ""} hint="e.g. hardwood, plywood, hinges, varnish" />
      </div>
      <FTextArea name="notes" label="Notes" rows={3} defaultValue={initial?.notes ?? ""} />
      <SubmitButton>{initial ? "Save supplier" : "Create supplier"}</SubmitButton>
    </ActionForm>
  );
}
