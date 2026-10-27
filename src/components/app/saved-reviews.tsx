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
  /** The date the review was posted, for sorting. */
  dateIso: string;
  hidden: boolean;
}

const SORTS = [
  { value: "newest", label: "Date: newest first" },
  { value: "oldest", label: "Date: oldest first" },
  { value: "az", label: "Name: A to Z" },
  { value: "za", label: "Name: Z to A" },
  { value: "stars-high", label: "Stars: most first" },
  { value: "stars-low", label: "Stars: fewest first" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];

const sortReviews = (list: SavedReview[], key: SortKey): SavedReview[] => {
  const byName = (a: SavedReview, b: SavedReview) => a.author.localeCompare(b.author, undefined, { sensitivity: "base" });
  const byDate = (a: SavedReview, b: SavedReview) => a.dateIso.localeCompare(b.dateIso);
  const out = [...list];
  switch (key) {
    case "oldest":
      return out.sort(byDate);
    case "az":
      return out.sort(byName);
    case "za":
      return out.sort((a, b) => byName(b, a));
    case "stars-high":
      return out.sort((a, b) => b.rating - a.rating || byDate(b, a));
    case "stars-low":
      return out.sort((a, b) => a.rating - b.rating || byDate(b, a));
    default:
      return out.sort((a, b) => byDate(b, a));
  }
};

/**
 * The saved reviews. Edit (above the table) shows a tick box on each row, and Hide (or Show) and Delete appear next to it. Reviews are
 * ticked one by one; there is no select-all box.
 */
export function SavedReviews({ reviews, hideAction, deleteAction }: { reviews: SavedReview[]; hideAction: Action; deleteAction: Action }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const sorted = sortReviews(reviews, sort);
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="mr-auto flex flex-wrap items-center gap-3">
            <p className="text-xs text-text-muted">
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </p>
            <label className="flex items-center gap-2 text-xs text-text-muted">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 border border-border-strong bg-surface px-3 text-[0.8125rem] text-text">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
        </div>
      ) : null}

      <TableWrap label="Saved Google reviews">
        <Table>
          <THead>
            <TR>
              <TH>Reviewer</TH>
              <TH>Review</TH>
              <TH className="text-center">Date</TH>
              <TH className="text-center">Status</TH>
            </TR>
          </THead>
          <tbody>
            {reviews.length === 0 ? <EmptyRow colSpan={4} title="No reviews saved yet" description="Add one above." /> : null}
            {sorted.map((r) => (
              <TR key={r.id} className={selected.has(r.id) ? "bg-linen" : undefined}>
                <TD>
                  <span className="flex items-start gap-3">
                    {/* The box always takes its room (hidden until Edit is pressed), so nothing in the table moves when Edit is pressed. */}
                    <input type="checkbox" aria-label={`Select the review by ${r.author}`} checked={selected.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} disabled={!editing} tabIndex={editing ? 0 : -1} aria-hidden={!editing} className={"mt-0.5 size-4 shrink-0 accent-[var(--color-walnut)] " + (editing ? "" : "invisible")} />
                    <span>
                      <span className="font-medium">{r.author}</span>
                      <span className="block text-xs text-text-muted">{"★".repeat(r.rating)}</span>
                    </span>
                  </span>
                </TD>
                <TD className="max-w-md">
                  {r.body ? <p className="line-clamp-3">{r.body}</p> : <span className="text-text-muted">No text</span>}
                </TD>
                <TD className="text-center">{r.dateText}</TD>
                <TD className="text-center">
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
