"use client";

import { useRef, useState } from "react";
import { setPaidAction } from "@/app/app/orders/actions";
import { PaidTag } from "@/components/app/tags";
import { ActionForm, useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

function Picker({
  id,
  reference,
  paid,
  refunded,
  canUpdate,
  disabled,
}: {
  id: string;
  reference: string;
  paid: boolean;
  refunded: boolean;
  canUpdate: boolean;
  disabled: boolean;
}) {
  const { pending } = useFormState();
  const [choice, setChoice] = useState(paid);
  const [open, setOpen] = useState(false);
  const paidInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input ref={paidInput} type="hidden" name="paid" value={String(choice)} readOnly />
      <button
        type="button"
        aria-label={`Edit payment status for order ${reference}`}
        title="Edit payment status"
        disabled={!canUpdate || disabled || pending}
        onClick={() => {
          setChoice(paid);
          setOpen(true);
        }}
        className="appearance-none border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut disabled:cursor-default"
      >
        <PaidTag paid={paid} refunded={refunded} />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Change payment status for order ${reference}`}
        description="Choose the payment status, then confirm the change."
      >
        <div className="flex w-full flex-col gap-2" role="group" aria-label="Payment statuses">
          {[false, true].map((option) => (
            <button
              key={String(option)}
              type="button"
              aria-pressed={choice === option}
              onClick={() => setChoice(option)}
              className={`min-h-9 w-full border px-3 text-left text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut ${choice === option ? "border-walnut ring-1 ring-walnut ring-offset-1" : "border-border"}`}
            >
              {option ? "Paid" : "Not paid"}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              paidInput.current?.form?.requestSubmit();
            }}
            disabled={pending || choice === paid}
          >
            Confirm
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function OrderPaymentPicker(props: {
  id: string;
  reference: string;
  paid: boolean;
  refunded?: boolean;
  canUpdate: boolean;
  disabled?: boolean;
}) {
  return (
    <ActionForm action={setPaidAction} className="!space-y-0">
      <Picker {...props} refunded={props.refunded ?? false} disabled={props.disabled ?? false} />
    </ActionForm>
  );
}
