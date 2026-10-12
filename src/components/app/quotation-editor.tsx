"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import { documentTotals, formatMoney, isDecimalString } from "@/lib/money";

export interface EditorItem {
  kind: "ready_made" | "custom";
  variantId: string;
  description: string;
  dimensions: string;
  material: string;
  finish: string;
  notes: string;
  quantity: string;
  unitPrice: string;
  discountAmount: string;
}

export interface VariantChoice {
  id: string;
  label: string;
  name: string;
  price: string | null;
}

export const blankItem = (kind: EditorItem["kind"]): EditorItem => ({ kind, variantId: "", description: "", dimensions: "", material: "", finish: "", notes: "", quantity: "1", unitPrice: "", discountAmount: "0" });

/**
 * Line-item editor. The preview totals are for convenience only: the server recomputes everything from
 * quantities and prices with decimal arithmetic and ignores any client-calculated figure.
 */
export function QuotationEditor({
  initial,
  variants,
  currency,
  deliveryCharge,
}: {
  initial: EditorItem[];
  variants: VariantChoice[];
  currency: string;
  deliveryCharge: string;
}) {
  const { state } = useFormState();
  const [items, setItems] = useState<EditorItem[]>(initial.length ? initial : [blankItem("custom")]);
  const [delivery, setDelivery] = useState(deliveryCharge);
  const patch = (i: number, p: Partial<EditorItem>) => setItems((cur) => cur.map((it, n) => (n === i ? { ...it, ...p } : it)));

  const valid = items.every((i) => isDecimalString(i.quantity || "x") && isDecimalString(i.unitPrice || "x") && isDecimalString(i.discountAmount || "0"));
  let preview: { subtotal: string; discount: string; total: string } | null = null;
  if (valid) {
    try {
      const t = documentTotals(
        items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount || "0" })),
        isDecimalString(delivery || "x") ? delivery : "0",
      );
      preview = { subtotal: t.subtotal.toFixed(2), discount: t.discountTotal.toFixed(2), total: t.total.toFixed(2) };
    } catch {
      preview = null;
    }
  }
  const itemErrors = state.fieldErrors?.itemsJson ?? [];

  return (
    <fieldset className="space-y-4">
      <legend className="font-display text-xl text-walnut">Items</legend>
      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
      {itemErrors.length > 0 ? (
        <Alert tone="danger" title="Please fix the items">
          <ul className="list-disc pl-5">
            {itemErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <ol className="space-y-4">
        {items.map((it, i) => (
          <li key={i} className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Item {i + 1} · {it.kind === "ready_made" ? "Ready-made" : "Custom"}
              </h3>
              {items.length > 1 ? (
                <Button variant="ghost" onClick={() => setItems((cur) => cur.filter((_, n) => n !== i))} aria-label={`Remove item ${i + 1}`}>
                  <Trash2 aria-hidden="true" className="size-4" /> Remove
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {it.kind === "ready_made" ? (
                <SelectField
                  label="Product"
                  required
                  value={it.variantId}
                  placeholder="Choose a product"
                  options={variants.map((v) => ({ value: v.id, label: v.label }))}
                  onChange={(e) => {
                    const v = variants.find((x) => x.id === e.target.value);
                    patch(i, { variantId: e.target.value, ...(v ? { description: it.description || v.name, unitPrice: it.unitPrice || (v.price ?? "") } : {}) });
                  }}
                  className="md:col-span-2"
                />
              ) : null}
              <TextField label="Description" required value={it.description} onChange={(e) => patch(i, { description: e.target.value })} className="md:col-span-2" />
              {it.kind === "custom" ? (
                <>
                  <TextField label="Dimensions" value={it.dimensions} onChange={(e) => patch(i, { dimensions: e.target.value })} placeholder="e.g. 180 × 90 × 75 cm" />
                  <TextField label="Wood / material" value={it.material} onChange={(e) => patch(i, { material: e.target.value })} />
                  <TextField label="Finish" value={it.finish} onChange={(e) => patch(i, { finish: e.target.value })} />
                  <TextAreaField label="Specification notes" rows={2} value={it.notes} onChange={(e) => patch(i, { notes: e.target.value })} />
                </>
              ) : null}
              <TextField label="Quantity" required inputMode="decimal" value={it.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
              <TextField label={`Unit price (${currency})`} required inputMode="decimal" value={it.unitPrice} onChange={(e) => patch(i, { unitPrice: e.target.value })} />
              <TextField label={`Discount on this line (${currency})`} inputMode="decimal" value={it.discountAmount} onChange={(e) => patch(i, { discountAmount: e.target.value })} hint="A total amount for the line, not per unit." />
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setItems((c) => [...c, blankItem("ready_made")])}>
          <Plus aria-hidden="true" className="size-4" /> Add ready-made item
        </Button>
        <Button variant="secondary" onClick={() => setItems((c) => [...c, blankItem("custom")])}>
          <Plus aria-hidden="true" className="size-4" /> Add custom item
        </Button>
      </div>

      <TextField
        label={`Delivery charge (${currency})`}
        name="deliveryCharge"
        inputMode="decimal"
        value={delivery}
        onChange={(e) => setDelivery(e.target.value)}
        error={state.fieldErrors?.deliveryCharge?.[0]}
        hint="Leave 0 if delivery is not charged."
        className="max-w-xs"
      />

      <dl className="ml-auto max-w-xs space-y-1 text-sm" aria-live="polite">
        <div className="flex justify-between"><dt className="text-text-muted">Subtotal</dt><dd className="tabular">{preview ? formatMoney(preview.subtotal, currency) : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-text-muted">Discounts</dt><dd className="tabular">{preview ? `− ${formatMoney(preview.discount, currency)}` : "—"}</dd></div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Total (incl. delivery)</dt><dd className="tabular">{preview ? formatMoney(preview.total, currency) : "—"}</dd></div>
        <p className="pt-1 text-xs text-text-muted">Preview only; the saved quotation is calculated by the server.</p>
      </dl>
    </fieldset>
  );
}
