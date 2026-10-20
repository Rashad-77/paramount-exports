"use client";

import { useState } from "react";
import { voidPaymentAction } from "@/app/app/orders/actions";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { Dialog } from "@/components/ui/dialog";

/** Undo an entry made by mistake. It stays on record, marked void, and stops being counted. */
export function VoidPaymentDialog({ orderId, paymentId, number }: { orderId: string; paymentId: string; number: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[0.8125rem] text-text-muted underline hover:text-text">
        Void
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Void ${number}?`} description="It stays on record but is no longer counted in the order's totals.">
        {open ? (
          <ActionForm action={voidPaymentAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="paymentId" value={paymentId} />
            <FField name="reason" label="Reason" required maxLength={300} />
            <SubmitButton variant="danger" pendingLabel="Voiding…">
              Void entry
            </SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
