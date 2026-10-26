"use client";

import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useResultToast } from "@/components/ui/toaster";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * The Delete button that sits next to Edit in the page header. It shows while the list is in edit mode, deletes the rows ticked on this
 * page (`items`: each row's id and what to call it), and asks first.
 */
export function DeleteSelectedButton({ items, singular, plural, field = "ids", action }: { items: { id: string; label: string }[]; singular: string; plural: string; field?: string; action: Action }) {
  const { editing, selected, setSelected } = useEdit();
  const [confirm, setConfirm] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (result.ok) setSelected(new Set());
    return result;
  }, {});
  useResultToast(state);

  if (!editing) return null;
  const chosen = items.filter((i) => selected.has(i.id));
  const noun = chosen.length === 1 ? singular : plural;
  return (
    <>
      <form ref={form} action={formAction}>
        {chosen.map((c) => (
          <input key={c.id} type="hidden" name={field} value={c.id} />
        ))}
        <Button type="button" variant="danger" disabled={chosen.length === 0 || pending} onClick={() => setConfirm(true)}>
          Delete{chosen.length > 0 ? ` (${chosen.length})` : ""}
        </Button>
      </form>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${chosen.length} ${noun}?`}
        description={`This permanently deletes ${chosen.map((c) => c.label).slice(0, 4).join(", ")}${chosen.length > 4 ? ` and ${chosen.length - 4} more` : ""}, with their replies. It cannot be undone.`}
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={() => {
          setConfirm(false);
          form.current?.requestSubmit();
        }}
      />
    </>
  );
}
