"use client";

import { CircleX } from "lucide-react";
import { useRef, useState } from "react";
import { setStatusFromListAction } from "@/app/app/orders/actions";
import { OrderTag, Tag } from "@/components/app/tags";
import { ActionForm, useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Fulfilment, OrderStatus } from "@/lib/order-constants";
import { ORDER_STATUSES, STATUS_LABEL } from "@/lib/order-constants";

type EditableOrderStatus = Exclude<OrderStatus, "in_progress">;
const STATUS_OPTIONS = ORDER_STATUSES.filter(
  (option): option is EditableOrderStatus => option !== "in_progress",
);
const STATUS_BUTTON_COLOR: Record<EditableOrderStatus, string> = {
  new: "tag-yellow",
  confirmed: "tag-teal",
  ready: "tag-purple",
  out_for_delivery: "tag-orange",
  delivered: "tag-green",
  cancelled: "tag-red",
};

function statusLabel(status: OrderStatus, paid: boolean, fulfilment: Fulfilment) {
  if (status === "delivered" && paid) return "Completed";
  if (status === "delivered") return fulfilment === "pickup" ? "Collected" : "Delivered";
  return STATUS_LABEL[status];
}

function Picker({
  id,
  reference,
  status,
  statusDate,
  statusDateLabel,
  isPaid,
  fulfilment,
  canUpdate,
  canCancel,
  customerCancelled,
}: {
  id: string;
  reference: string;
  status: OrderStatus;
  statusDate: string | null;
  statusDateLabel: string | null;
  isPaid: boolean;
  fulfilment: Fulfilment;
  canUpdate: boolean;
  canCancel: boolean;
  customerCancelled: boolean;
}) {
  const { pending } = useFormState();
  const selected = status === "in_progress" ? "confirmed" : status;
  const [choice, setChoice] = useState<OrderStatus>(selected);
  const [open, setOpen] = useState(false);
  const statusInput = useRef<HTMLInputElement>(null);

  if (customerCancelled) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Tag color="red" icon={CircleX}>Customer cancelled</Tag>
        {statusDateLabel ? <time dateTime={statusDate ?? undefined} className="text-[0.65rem] leading-none text-text-muted">{statusDateLabel}</time> : null}
      </div>
    );
  }

  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input ref={statusInput} type="hidden" name="status" value={choice} readOnly />
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label={`Edit status for order ${reference}`}
          title="Edit status"
          disabled={!canUpdate || pending}
          onClick={() => {
            setChoice(selected);
            setOpen(true);
          }}
          className="appearance-none border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut disabled:cursor-default"
        >
          <OrderTag status={status} isPaid={isPaid} fulfilment={fulfilment} />
        </button>
        {statusDateLabel ? <time dateTime={statusDate ?? undefined} className="text-[0.65rem] leading-none text-text-muted">{statusDateLabel}</time> : null}
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Change status for order ${reference}`}
        description="Choose the order status, then confirm the change."
      >
        <div className="flex w-full flex-col gap-2" role="group" aria-label="Order statuses">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={choice === option}
              disabled={option === "cancelled" && !canCancel}
              onClick={() => setChoice(option)}
              className={`tag ${STATUS_BUTTON_COLOR[option]} min-h-9 w-full justify-start border px-3 text-left text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut disabled:cursor-not-allowed disabled:opacity-50 ${choice === option ? "ring-1 ring-walnut ring-offset-1" : ""}`}
            >
              {statusLabel(option, isPaid, fulfilment)}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={choice === "cancelled" ? "danger" : "primary"}
            onClick={() => {
              setOpen(false);
              statusInput.current?.form?.requestSubmit();
            }}
            disabled={pending || choice === selected || (choice === "cancelled" && !canCancel)}
          >
            {choice === "cancelled" ? "Confirm cancellation" : "Confirm"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export function OrderStatusPicker(props: {
  id: string;
  reference: string;
  status: OrderStatus;
  statusDate: string | null;
  statusDateLabel: string | null;
  isPaid: boolean;
  fulfilment: Fulfilment;
  canUpdate: boolean;
  canCancel: boolean;
  customerCancelled: boolean;
}) {
  return (
    <ActionForm action={setStatusFromListAction} className="!space-y-0">
      <Picker {...props} />
    </ActionForm>
  );
}
