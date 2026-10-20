"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { updateItemsAction } from "@/app/app/orders/actions";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { PanelSelect } from "@/components/app/panel-select";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export interface EditableItem {
  id: string;
  name: string;
  detail: string;
  unitPrice: string;
  quantity: number;
  returned: number;
}
export interface VariantChoice {
  id: string;
  label: string;
  price: string | null;
}

/** Change the quantities, remove lines or add products on an order that has not been delivered. Stock and the total follow. */
export function OrderItemsEditor({ orderId, items, options, currency }: { orderId: string; items: EditableItem[]; options: VariantChoice[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, i.quantity])));
  const [added, setAdded] = useState<Array<{ variantId: string; quantity: number }>>([]);
  const [pick, setPick] = useState("");
  const changes = items.filter((i) => qty[i.id] !== i.quantity).map((i) => ({ itemId: i.id, quantity: qty[i.id] ?? i.quantity }));
  const priced = options.filter((o) => o.price !== null);
  const label = (id: string) => priced.find((o) => o.id === id)?.label ?? id;
  const total =
    items.reduce((n, i) => n + (qty[i.id] ?? i.quantity) * Number(i.unitPrice), 0) +
    added.reduce((n, a) => n + a.quantity * Number(priced.find((o) => o.id === a.variantId)?.price ?? 0), 0);
  const reset = () => {
    setQty(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
    setAdded([]);
    setPick("");
  };
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Pencil aria-hidden="true" className="size-4" /> Edit items
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit items" description="Change a quantity, set it to 0 to remove a line, or add a product. Stock and the total are adjusted.">
        {open ? (
          <ActionForm action={updateItemsAction}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <input type="hidden" name="id" value={orderId} />
            <input type="hidden" name="changes" value={JSON.stringify(changes)} />
            <input type="hidden" name="add" value={JSON.stringify(added.filter((a) => a.quantity > 0))} />
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block truncate text-[0.8125rem] text-text-muted">
                      {[i.detail, `${currency} ${Number(i.unitPrice).toLocaleString("en-LK")} each`, i.returned ? `${i.returned} returned` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <input
                    type="number"
                    aria-label={`Quantity of ${i.name}`}
                    min={i.returned}
                    max={99}
                    value={qty[i.id] ?? i.quantity}
                    onChange={(e) => setQty({ ...qty, [i.id]: Math.max(i.returned, Math.min(99, Number(e.target.value) || 0)) })}
                    className="h-9 w-16 border border-border-strong bg-surface px-2 text-center text-sm"
                  />
                </li>
              ))}
              {added.map((a, n) => (
                <li key={a.variantId} className="flex items-center gap-3 border border-dashed border-border-strong px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="mr-2 text-[0.8125rem] text-text-muted">New</span>
                    {label(a.variantId)}
                  </span>
                  <input
                    type="number"
                    aria-label={`Quantity of ${label(a.variantId)}`}
                    min={0}
                    max={99}
                    value={a.quantity}
                    onChange={(e) => setAdded(added.map((x, i) => (i === n ? { ...x, quantity: Math.max(0, Math.min(99, Number(e.target.value) || 0)) } : x)))}
                    className="h-9 w-16 border border-border-strong bg-surface px-2 text-center text-sm"
                  />
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <PanelSelect
                  label="Add a product"
                  placeholder="Choose a product option"
                  value={pick}
                  onChange={setPick}
                  options={priced.filter((o) => !added.some((a) => a.variantId === o.id)).map((o) => ({ value: o.id, label: o.label }))}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!pick}
                onClick={() => {
                  setAdded([...added, { variantId: pick, quantity: 1 }]);
                  setPick("");
                }}
              >
                <Plus aria-hidden="true" className="size-4" /> Add
              </Button>
            </div>
            <p className="text-sm">
              Items after the change: <strong>{currency} {total.toLocaleString("en-LK")}</strong>
            </p>
            <SubmitButton pendingLabel="Saving…">Save items</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
