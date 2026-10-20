"use client";

import { Undo2 } from "lucide-react";
import { useState } from "react";
import { setStatusAction } from "@/app/app/orders/actions";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Marks a delivered order as refunded: the items go back in stock and the order shows a Refunded tag. The money is returned outside the system. */
export function MarkRefundedDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Undo2 aria-hidden="true" className="size-4" /> Mark as refunded
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Mark this order as refunded?" description="The items go back in stock and the order shows a Refunded tag. Return the money to the customer yourself: this only records it.">
        {open ? (
          <ActionForm action={setStatusAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="status" value="refunded" />
            <FField name="reason" label="Reason" maxLength={400} hint="Why the order is being refunded, for your records and the customer's notice." />
            <SubmitButton variant="danger" pendingLabel="Saving…">
              Mark as refunded
            </SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
