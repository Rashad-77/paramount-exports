"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton, useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { dec, isDecimalString, moneyString } from "@/lib/money";
import type { ActionState } from "@/lib/action-state";

export interface ItemChoice {
  id: string;
  sku: string;
  name: string;
  unit: string;
  costPrice: string | null;
}
interface Row {
  key: number;
  itemId: string;
  quantity: string;
  expectedUnitCost: string;
}

const blankRow = (key: number): Row => ({ key, itemId: "", quantity: "", expectedUnitCost: "" });

function Lines({ items, initial, currency, showCosts }: { items: ItemChoice[]; initial: Array<{ itemId: string; quantity: string; expectedUnitCost: string }>; currency: string; showCosts: boolean }) {
  const { state } = useFormState();
  // Row keys come from state (not a module counter) so server and client render identical ids.
  const [{ rows }, setList] = useState<{ rows: Row[]; next: number }>(() => ({ rows: initial.length ? initial.map((r, i) => ({ ...r, key: i + 1 })) : [blankRow(1)], next: Math.max(initial.length, 1) + 1 }));
  const setRows = (fn: (cur: Row[]) => Row[]) => setList((cur) => ({ ...cur, rows: fn(cur.rows) }));
  const byId = new Map(items.map((i) => [i.id, i]));
  const patch = (key: number, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const total = rows.reduce((s, r) => (isDecimalString(r.quantity) && isDecimalString(r.expectedUnitCost) ? s.plus(dec(r.quantity).times(r.expectedUnitCost)) : s), dec(0));
  const error = state.fieldErrors?.itemsJson?.[0];
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Items to order</legend>
      <input type="hidden" name="itemsJson" value={JSON.stringify(rows.filter((r) => r.itemId).map(({ itemId, quantity, expectedUnitCost }) => ({ itemId, quantity, expectedUnitCost: expectedUnitCost || "0" })))} />
      {rows.map((r, i) => {
        const unit = byId.get(r.itemId)?.unit;
        return (
          <div key={r.key} className="grid items-end gap-3 border border-border p-3 sm:grid-cols-[1fr_8rem_9rem_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`po-item-${r.key}`}>Item {i + 1}</label>
              <select
                id={`po-item-${r.key}`}
                value={r.itemId}
                onChange={(e) => {
                  const it = byId.get(e.target.value);
                  patch(r.key, { itemId: e.target.value, expectedUnitCost: r.expectedUnitCost || (showCosts && it?.costPrice ? it.costPrice : "") });
                }}
                className="block min-h-10 w-full border border-border-strong bg-surface px-3 py-2 text-base"
              >
                <option value="">Choose an item</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.name} ({it.sku})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`po-qty-${r.key}`}>Quantity{unit ? ` (${unit})` : ""}</label>
              <input id={`po-qty-${r.key}`} inputMode="decimal" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} className="block min-h-10 w-full border border-border-strong bg-surface px-3 py-2 text-base" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={`po-cost-${r.key}`}>Expected unit cost ({currency})</label>
              <input id={`po-cost-${r.key}`} inputMode="decimal" value={r.expectedUnitCost} onChange={(e) => patch(r.key, { expectedUnitCost: e.target.value })} className="block min-h-10 w-full border border-border-strong bg-surface px-3 py-2 text-base" />
            </div>
            <Button variant="ghost" aria-label={`Remove item ${i + 1}`} onClick={() => setList((cur) => (cur.rows.length > 1 ? { ...cur, rows: cur.rows.filter((x) => x.key !== r.key) } : { rows: [blankRow(cur.next)], next: cur.next + 1 }))}>
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
        );
      })}
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setList((cur) => ({ rows: [...cur.rows, blankRow(cur.next)], next: cur.next + 1 }))}>
          <Plus aria-hidden="true" className="size-4" /> Add item
        </Button>
        <p className="text-sm text-text-muted">Expected value: <span className="tabular font-semibold text-text">{moneyString(total)} {currency}</span></p>
      </div>
    </fieldset>
  );
}

export function PoForm({
  action,
  hidden,
  suppliers,
  locations,
  items,
  currency,
  showCosts,
  initial,
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  suppliers: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  items: ItemChoice[];
  currency: string;
  showCosts: boolean;
  initial: { supplierId: string; locationId: string; expectedOn: string; notes: string; lines: Array<{ itemId: string; quantity: string; expectedUnitCost: string }> };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="grid gap-5 md:grid-cols-2">
        <FSelect name="supplierId" label="Supplier" required defaultValue={initial.supplierId} placeholder="Choose a supplier" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <FSelect name="locationId" label="Receive into" required defaultValue={initial.locationId} placeholder="Choose a location" options={locations.map((l) => ({ value: l.id, label: l.name }))} hint="Stock is added here as goods are received." />
        <FField name="expectedOn" label="Expected on" type="date" defaultValue={initial.expectedOn} />
      </div>
      <Lines items={items} initial={initial.lines} currency={currency} showCosts={showCosts} />
      <FTextArea name="notes" label="Notes" rows={2} defaultValue={initial.notes} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
