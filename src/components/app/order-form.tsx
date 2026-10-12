import { ActionForm, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";
import { QuotationEditor, type EditorItem, type VariantChoice } from "./quotation-editor";

export function OrderForm({
  action,
  hidden,
  initial,
  variants,
  locations,
  currency,
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  initial: { locationId: string; deliveryCharge: string; depositTerms: string; notes: string; items: EditorItem[] };
  variants: VariantChoice[];
  locations: Array<{ id: string; name: string }>;
  currency: string;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-5 md:grid-cols-2">
        <FSelect name="locationId" label="Stock comes from" required defaultValue={initial.locationId} placeholder="Choose a location" options={locations.map((l) => ({ value: l.id, label: l.name }))} hint="Stock is reserved here when the order is confirmed." />
      </div>
      <QuotationEditor initial={initial.items} variants={variants} currency={currency} deliveryCharge={initial.deliveryCharge} allowCustom={false} />
      <FTextArea name="depositTerms" label="Deposit and payment terms" rows={2} defaultValue={initial.depositTerms} hint="Free text, e.g. “Half now, half on delivery”. No percentage is assumed." />
      <FTextArea name="notes" label="Notes" rows={2} defaultValue={initial.notes} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
