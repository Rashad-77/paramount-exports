import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";
import { QuotationEditor, type EditorItem, type VariantChoice } from "./quotation-editor";

export function QuotationForm({
  action,
  hidden,
  initial,
  variants,
  currency,
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  initial: { validUntil: string; deliveryCharge: string; terms: string; customerNotes: string; internalNotes: string; items: EditorItem[] };
  variants: VariantChoice[];
  currency: string;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-5 md:grid-cols-2">
        <FField name="validUntil" label="Valid until" type="date" required defaultValue={initial.validUntil} hint="The last day the customer can accept this quotation." />
      </div>
      <QuotationEditor initial={initial.items} variants={variants} currency={currency} deliveryCharge={initial.deliveryCharge} />
      <FTextArea name="terms" label="Terms" rows={3} defaultValue={initial.terms} hint="Payment, deposit and delivery terms shown on the quotation." />
      <FTextArea name="customerNotes" label="Notes for the customer" rows={2} defaultValue={initial.customerNotes} />
      <FTextArea name="internalNotes" label="Internal notes" rows={2} defaultValue={initial.internalNotes} hint="Never shown on the printed quotation." />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
