"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm, FField, FSelect, SubmitButton, useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Alert } from "@/components/ui/status";
import type { ActionState } from "@/lib/action-state";

interface Line {
  itemId: string;
  quantity: string;
}

function Lines({ items }: { items: Array<{ id: string; label: string }> }) {
  const { state } = useFormState();
  const [lines, setLines] = useState<Line[]>([{ itemId: "", quantity: "1" }]);
  const patch = (i: number, p: Partial<Line>) => setLines((c) => c.map((l, n) => (n === i ? { ...l, ...p } : l)));
  const errs = state.fieldErrors?.linesJson ?? [];
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Items to move</legend>
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />
      {errs.length ? <Alert tone="danger">{errs[0]}</Alert> : null}
      {lines.map((l, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
          <SelectField label={`Item ${i + 1}`} showOptional={false} required value={l.itemId} placeholder="Choose an item" options={items.map((x) => ({ value: x.id, label: x.label }))} onChange={(e) => patch(i, { itemId: e.target.value })} />
          <TextField label="Quantity" showOptional={false} required inputMode="decimal" value={l.quantity} onChange={(e) => patch(i, { quantity: e.target.value })} />
          {lines.length > 1 ? (
            <Button variant="ghost" onClick={() => setLines((c) => c.filter((_, n) => n !== i))} aria-label={`Remove item ${i + 1}`}>
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}
      <Button variant="secondary" onClick={() => setLines((c) => [...c, { itemId: "", quantity: "1" }])}>
        <Plus aria-hidden="true" className="size-4" /> Add another item
      </Button>
    </fieldset>
  );
}

export function TransferForm({ action, locations, items }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; locations: Array<{ id: string; name: string }>; items: Array<{ id: string; label: string }> }) {
  const opts = locations.map((l) => ({ value: l.id, label: l.name }));
  return (
    <ActionForm action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FSelect name="fromLocationId" label="From" required placeholder="Choose a location" options={opts} />
        <FSelect name="toLocationId" label="To" required placeholder="Choose a location" options={opts} />
      </div>
      <Lines items={items} />
      <FField name="note" label="Note" hint="Why the stock is moving, e.g. “For finishing”." />
      <SubmitButton>Record transfer</SubmitButton>
    </ActionForm>
  );
}
