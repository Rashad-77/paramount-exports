"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { EmptyRow, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { useResultToast } from "@/components/ui/toaster";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export interface SavedReview {
  id: string;
  author: string;
  rating: number;
  body: string;
  dateText: string;
  hidden: boolean;
}

/**
 * The saved reviews. Edit (above the table) shows a tick box on each row, and Hide (or Show) and Delete appear next to it. Reviews are
 * ticked one by one; there is no select-all box.
 */
export function SavedReviews({ reviews, hideAction, deleteAction }: { reviews: SavedReview[]; hideAction: Action; deleteAction: Action }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const deleteForm = useRef<HTMLFormElement>(null);

  const [hideState, hideFormAction, hiding] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await hideAction(prev, fd);
    if (r.ok) setSelected(new Set());
    return r;
  }, {});
  const [deleteState, deleteFormAction, deleting] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await deleteAction(prev, fd);
    if (r.ok) setSelected(new Set());
    return r;
  }, {});
  useResultToast(hideState);
  useResultToast(deleteState);

  const chosen = reviews.filter((r) => selected.has(r.id));
  // Hide the ticked reviews, or show them again when every ticked one is already hidden.
  const showThem = chosen.length > 0 && chosen.every((r) => r.hidden);
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const count = chosen.length > 0 ? ` (${chosen.length})` : "";
  const noun = chosen.length === 1 ? "review" : "reviews";

  return (
    <div className="space-y-4">
      {reviews.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={editing ? "primary" : "secondary"}
            onClick={() => {
              setEditing((e) => !e);
              setSelected(new Set());
            }}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          {editing ? (
            <>
              <form action={hideFormAction}>
                {chosen.map((c) => (
                  <input key={c.id} type="hidden" name="ids" value={c.id} />
                ))}
                <input type="hidden" name="hidden" value={showThem ? "false" : "true"} />
                <Button type="submit" variant="secondary" disabled={chosen.length === 0 || hiding}>
                  {showThem ? "Show" : "Hide"}
                  {count}
                </Button>
              </form>
              <form ref={deleteForm} action={deleteFormAction}>
                {chosen.map((c) => (
                  <input key={c.id} type="hidden" name="ids" value={c.id} />
                ))}
                <Button type="button" variant="danger" disabled={chosen.length === 0 || deleting} onClick={() => setConfirm(true)}>
                  Delete{count}
                </Button>
              </form>
            </>
          ) : null}
        </div>
      ) : null}

      <TableWrap label="Saved Google reviews">
        <Table>
          <THead>
            <TR>
              <TH>Reviewer</TH>
              <TH>Review</TH>
              <TH>Date</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {reviews.length === 0 ? <EmptyRow colSpan={4} title="No reviews saved yet" description="Add one above." /> : null}
            {reviews.map((r) => (
              <TR key={r.id} className={selected.has(r.id) ? "bg-linen" : undefined}>
                <TD>
                  <span className="flex items-start gap-3">
                    {editing ? <input type="checkbox" aria-label={`Select the review by ${r.author}`} checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-walnut)]" /> : null}
                    <span>
                      <span className="font-medium">{r.author}</span>
                      <span className="block text-xs text-text-muted">{"★".repeat(r.rating)}</span>
                    </span>
                  </span>
                </TD>
                <TD className="max-w-md">
                  <p className="line-clamp-3">{r.body}</p>
                </TD>
                <TD>{r.dateText}</TD>
                <TD>
                  <StatusBadge tone={r.hidden ? "warning" : "success"}>{r.hidden ? "Hidden" : "Shown"}</StatusBadge>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${chosen.length} ${noun}?`}
        description="They are removed from the website and from the saved reviews. It cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={() => {
          setConfirm(false);
          deleteForm.current?.requestSubmit();
        }}
      />
    </div>
  );
}
