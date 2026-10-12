"use client";

import { useState } from "react";
import { ActionForm, FField, FSelect, SubmitButton, useFormState } from "@/components/forms/action-form";
import type { ActionState } from "@/lib/action-state";

/**
 * One submission = one key. The key is what makes recording idempotent: a double tap or a retried request returns the
 * original record instead of deducting stock twice. After a successful save the form gets a fresh key for the next entry.
 */
function KeyField({ initialKey }: { initialKey: string }) {
  const { state } = useFormState();
  const [key, setKey] = useState(initialKey);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) setKey(crypto.randomUUID());
  }
  return <input type="hidden" name="requestKey" value={key} />;
}

export function ConsumptionForm({
  action,
  jobId,
  initialKey,
  materials,
  locations,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  jobId: string;
  initialKey: string;
  materials: Array<{ id: string; name: string; unit: string }>;
  locations: Array<{ id: string; name: string }>;
}) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="jobId" value={jobId} />
      <KeyField initialKey={initialKey} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FSelect name="itemId" label="Material" required placeholder="Choose a material" options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))} />
        <FSelect name="locationId" label="Taken from" required placeholder="Choose a location" defaultValue={locations[0]?.id} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
        <FField name="quantity" label="Quantity used" inputMode="decimal" required />
        <FField name="wasteQuantity" label="Quantity wasted" inputMode="decimal" hint="Offcuts or spoiled material, if any." />
      </div>
      <FField name="note" label="Note" />
      <SubmitButton size="lg" pendingLabel="Recording…">Record usage</SubmitButton>
    </ActionForm>
  );
}
