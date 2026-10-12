import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

export interface DeliveryValues {
  scheduledOn: string;
  windowStart: string;
  windowEnd: string;
  addressLine: string;
  contactName: string;
  contactPhone: string;
  fee: string;
  assigneeId: string;
  notes: string;
}

export function DeliveryForm({
  action,
  hidden,
  initial,
  staff,
  currency,
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  initial: DeliveryValues;
  staff: Array<{ id: string; name: string }>;
  currency: string;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="scheduledOn" label="Delivery date" type="date" required defaultValue={initial.scheduledOn} />
        <FSelect name="assigneeId" label="Delivered by" defaultValue={initial.assigneeId} placeholder="Not assigned yet" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
        <FField name="windowStart" label="Window starts" type="time" defaultValue={initial.windowStart} hint="Leave both blank for any time that day." />
        <FField name="windowEnd" label="Window ends" type="time" defaultValue={initial.windowEnd} />
        <FField name="contactName" label="Contact at the address" required defaultValue={initial.contactName} />
        <FField name="contactPhone" label="Contact phone" type="tel" required defaultValue={initial.contactPhone} />
      </div>
      <FTextArea name="addressLine" label="Delivery address" required rows={2} defaultValue={initial.addressLine} />
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="fee" label={`Delivery fee (${currency})`} inputMode="decimal" defaultValue={initial.fee} hint="For reference. The amount charged to the customer is the order's delivery charge." />
        <FTextArea name="notes" label="Notes for the driver" rows={2} defaultValue={initial.notes} />
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
