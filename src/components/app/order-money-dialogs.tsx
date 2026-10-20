"use client";

import { Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { recordPaymentAction, refundAction, voidPaymentAction } from "@/app/app/orders/actions";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

/** Record money received: a full payment, or a part payment such as a deposit. */
export function RecordPaymentDialog({ orderId, balance, currency, defaultMethod }: { orderId: string; balance: string; currency: string; defaultMethod: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" className="size-4" /> Record payment
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record a payment" description={`Balance due: ${currency} ${Number(balance).toLocaleString("en-LK")}. A part payment, such as a deposit, is fine.`}>
        {open ? (
          <ActionForm action={recordPaymentAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <FField name="amount" label={`Amount (${currency})`} inputMode="decimal" required defaultValue={balance} />
            <FPanelSelect name="method" label="Paid by" defaultValue={defaultMethod} options={METHODS} />
            <FField name="reference" label="Reference" maxLength={120} hint="A transfer or slip number, if there is one." />
            <FField name="paidOn" label="Date received" type="date" hint="Leave blank for today." />
            <FField name="note" label="Note" maxLength={300} />
            <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}

export interface ReturnableItem {
  id: string;
  name: string;
  detail: string;
  unitPrice: string;
  /** How many can still come back. */
  available: number;
}

/** Pay money back, take items back, or both. Returned items go back on the shelf. */
export function RefundDialog({ orderId, maxAmount, currency, items }: { orderId: string; maxAmount: string; currency: string; items: ReturnableItem[] }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [amount, setAmount] = useState("");
  const [amountKey, setAmountKey] = useState(0);
  const returnsValue = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
  const suggested = items.reduce((n, i) => n + (qty[i.id] ?? 0) * Number(i.unitPrice), 0);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Undo2 aria-hidden="true" className="size-4" /> Refund or return
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Refund or return" description={`Paid and not yet refunded: ${currency} ${Number(maxAmount).toLocaleString("en-LK")}.`}>
        {open ? (
          <ActionForm action={refundAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="returns" value={JSON.stringify(returnsValue)} />
            {items.some((i) => i.available > 0) ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium tracking-[0.01em] text-text">Items that came back</legend>
                {items.map((i) =>
                  i.available > 0 ? (
                    <div key={i.id} className="flex items-center gap-3 border border-border px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{i.name}</span>
                        <span className="block truncate text-[0.8125rem] text-text-muted">{i.detail || `${currency} ${Number(i.unitPrice).toLocaleString("en-LK")} each`}</span>
                      </span>
                      <label className="flex items-center gap-2 text-[0.8125rem] text-text-muted">
                        Back
                        <input
                          type="number"
                          min={0}
                          max={i.available}
                          value={qty[i.id] ?? 0}
                          onChange={(e) => setQty({ ...qty, [i.id]: Math.max(0, Math.min(i.available, Number(e.target.value) || 0)) })}
                          className="h-9 w-16 border border-border-strong bg-surface px-2 text-center text-sm text-text"
                        />
                        <span>of {i.available}</span>
                      </label>
                    </div>
                  ) : null,
                )}
                <p className="text-[0.8125rem] text-text-muted">Returned items are put back in stock.</p>
              </fieldset>
            ) : null}
            <div>
              <FField key={amountKey} name="amount" label={`Amount to refund (${currency})`} inputMode="decimal" defaultValue={amount} hint="Leave blank if the items came back and no money is paid back." />
              {suggested > 0 ? (
                <button type="button" className="mt-1 text-[0.8125rem] underline" onClick={() => {
                    setAmount(String(Math.min(suggested, Number(maxAmount))));
                    setAmountKey((k) => k + 1);
                  }}>
                  Use the value of the returned items ({currency} {suggested.toLocaleString("en-LK")})
                </button>
              ) : null}
            </div>
            <FPanelSelect name="method" label="Paid back by" defaultValue="cash" options={METHODS} />
            <FField name="reason" label="Reason" required maxLength={300} />
            <FField name="reference" label="Reference" maxLength={120} />
            <SubmitButton pendingLabel="Recording…">Record refund</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}

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
