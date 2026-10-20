"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { createCaseAction, resolveCaseAction } from "@/app/app/orders/actions";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FField, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const KINDS = [
  { value: "complaint", label: "Complaint" },
  { value: "repair", label: "Repair" },
  { value: "warranty", label: "Warranty claim" },
  { value: "other", label: "Other" },
];

/** Opens an after-sales case on the order. */
export function NewCaseDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" className="size-4" /> New case
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New after-sales case" description="A complaint, repair or warranty claim about this order.">
        {open ? (
          <ActionForm action={createCaseAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <FPanelSelect name="kind" label="What kind of case is it?" defaultValue="complaint" options={KINDS} />
            <FField name="title" label="Short title" required maxLength={140} />
            <FTextArea name="details" label="Details" rows={3} maxLength={1000} />
            <SubmitButton pendingLabel="Opening…">Open case</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}

/** Marks a case resolved (with what was done), or reopens a resolved one. */
export function ResolveCaseDialog({ orderId, caseId, title, reopen }: { orderId: string; caseId: string; title: string; reopen: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[0.8125rem] underline hover:text-text">
        {reopen ? "Reopen" : "Resolve"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={reopen ? "Reopen this case?" : "Resolve this case"} description={title}>
        {open ? (
          <ActionForm action={resolveCaseAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="orderId" value={orderId} />
            {reopen ? <input type="hidden" name="reopen" value="true" /> : <FTextArea name="resolution" label="What was done" rows={3} maxLength={600} />}
            <SubmitButton pendingLabel="Saving…">{reopen ? "Reopen case" : "Mark as resolved"}</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
