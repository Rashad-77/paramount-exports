"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { CloseOnSuccess } from "@/components/app/add-category-dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
export interface OrderItem {
  id: string;
  name: string;
  /** How many subcategories it has, shown as a quiet note. */
  subcategories: number;
}

/** The numbered, draggable list. The hidden `ids` fields carry the order to the server. */
function OrderList({ initial }: { initial: OrderItem[] }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const move = (from: string, to: string) => {
    if (from === to) return;
    const next = [...items];
    const a = next.findIndex((i) => i.id === from);
    const b = next.findIndex((i) => i.id === to);
    if (a < 0 || b < 0) return;
    const [item] = next.splice(a, 1);
    next.splice(b, 0, item!);
    setItems(next);
  };
  const shift = (id: string, by: -1 | 1) => {
    const a = items.findIndex((i) => i.id === id);
    const b = a + by;
    if (b < 0 || b >= items.length) return;
    const next = [...items];
    [next[a], next[b]] = [next[b]!, next[a]!];
    setItems(next);
  };
  const changed = items.some((it, i) => it.id !== initial[i]?.id);

  return (
    <>
      <ol className="space-y-1.5" aria-label="Main categories in order">
        {items.map((it, i) => (
          <li
            key={it.id}
            draggable
            onDragStart={(e) => {
              setDragId(it.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", it.id);
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(it.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) move(dragId, it.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onKeyDown={(e) => {
              if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                shift(it.id, e.key === "ArrowUp" ? -1 : 1);
              }
            }}
            tabIndex={0}
            aria-label={`${i + 1}. ${it.name}. Drag, or press Alt and an arrow key, to change its place.`}
            className={cn(
              "flex cursor-grab items-center gap-3 border border-border bg-surface px-3 py-2 text-sm active:cursor-grabbing",
              dragId === it.id && "opacity-40",
              overId === it.id && dragId !== it.id && "ring-2 ring-walnut",
            )}
          >
            <GripVertical aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            <span className="tabular w-6 shrink-0 text-right font-semibold">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{it.name}</span>
            {it.subcategories > 0 ? (
              <span className="shrink-0 text-[0.8125rem] text-text-muted">
                {it.subcategories} {it.subcategories === 1 ? "subcategory" : "subcategories"}
              </span>
            ) : null}
            <span className="flex shrink-0 flex-col">
              <button type="button" aria-label={`Move ${it.name} up`} disabled={i === 0} onClick={() => shift(it.id, -1)} className="p-0.5 text-text-muted hover:text-text disabled:opacity-30">
                <ChevronUp aria-hidden="true" className="size-3.5" />
              </button>
              <button type="button" aria-label={`Move ${it.name} down`} disabled={i === items.length - 1} onClick={() => shift(it.id, 1)} className="p-0.5 text-text-muted hover:text-text disabled:opacity-30">
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            </span>
            <input type="hidden" name="ids" value={it.id} />
          </li>
        ))}
      </ol>
      <p className="text-[0.8125rem] text-text-muted">Drag a category to change its number. Number 1 comes first in the website menus. Subcategories stay under their main category.</p>
      <SubmitButton pendingLabel="Saving…" className={changed ? undefined : "opacity-60"}>
        Save order
      </SubmitButton>
    </>
  );
}

/** The Display order button and its pop-up. */
export function DisplayOrderDialog({ action, items }: { action: Action; items: OrderItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Display order
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Display order" description="The order of the main categories in the website menus.">
        {open ? (
          <ActionForm action={action}>
            <CloseOnSuccess onClose={() => setOpen(false)} />
            <OrderList initial={items} />
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
