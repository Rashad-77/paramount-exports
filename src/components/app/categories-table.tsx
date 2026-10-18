"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert, StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import type { ActionState } from "@/lib/action-state";

export interface CategoryRow {
  id: string;
  name: string;
  /** A category under a group (indented in the list). */
  depth: 0 | 1;
  productCount: number;
  isActive: boolean;
  archived: boolean;
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * The staff category list, laid out like the product list: numbered rows, a status badge, and an Edit button (in the page header)
 * that shows tick boxes so several can be archived, restored or deleted at once. Deleting asks first.
 */
export function CategoriesTable({
  rows,
  total,
  canWrite,
  archiveAction,
  deleteAction,
}: {
  rows: CategoryRow[];
  total: number;
  canWrite: boolean;
  archiveAction: Action;
  deleteAction: Action;
}) {
  const { editing, selected, setSelected } = useEdit();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // A finished action clears the ticks (the rows themselves refresh from the server).
  const clearAfter =
    (run: Action): Action =>
    async (prev, fd) => {
      const result = await run(prev, fd);
      if (result.ok) setSelected(new Set());
      return result;
    };
  const [archiveState, archiveForm, archivePending] = useActionState(clearAfter(archiveAction), {});
  const [deleteState, deleteForm, deletePending] = useActionState(clearAfter(deleteAction), {});
  const deleteRef = useRef<HTMLFormElement>(null);

  const onPage = new Set(rows.map((r) => r.id));
  const ticked = [...selected].filter((id) => onPage.has(id));
  const allTicked = rows.length > 0 && ticked.length === rows.length;
  const anyArchivedTicked = rows.some((r) => selected.has(r.id) && r.archived);
  const anyLiveTicked = rows.some((r) => selected.has(r.id) && !r.archived);
  const busy = archivePending || deletePending;
  const message = [deleteState, archiveState].find((s) => s.error || (s.ok && s.message));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const idInputs = ticked.map((id) => <input key={id} type="hidden" name="ids" value={id} />);

  return (
    <>
      <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-text-muted" role="status">
          {total} {total === 1 ? "category" : "categories"}
          {editing ? <span> · {ticked.length} selected</span> : null}
        </p>
        {canWrite && editing ? (
          <div className="flex flex-wrap items-center gap-2">
            {anyLiveTicked || ticked.length === 0 ? (
              <form action={archiveForm}>
                {idInputs}
                <input type="hidden" name="archive" value="true" />
                <Button type="submit" variant="secondary" disabled={ticked.length === 0 || busy}>
                  Archive
                </Button>
              </form>
            ) : null}
            {anyArchivedTicked ? (
              <form action={archiveForm}>
                {idInputs}
                <input type="hidden" name="archive" value="false" />
                <Button type="submit" variant="secondary" disabled={busy}>
                  Restore
                </Button>
              </form>
            ) : null}
            <form ref={deleteRef} action={deleteForm}>
              {idInputs}
              <Button type="button" variant="danger" disabled={ticked.length === 0 || busy} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mb-3">
          <Alert tone={message.error ? "danger" : "success"}>{message.error ?? message.message}</Alert>
        </div>
      ) : null}

      <TableWrap label="Categories">
        <Table>
          <THead>
            <tr>
              {editing ? (
                <TH className="w-10 px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all categories"
                    checked={allTicked}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    className="size-4"
                  />
                </TH>
              ) : null}
              <TH className="w-12 px-2 py-1.5 text-left">No.</TH>
              <TH className="px-2 py-1.5 text-left">Category</TH>
              <TH className="px-2 py-1.5 text-left">Products</TH>
              <TH className="px-2 py-1.5 text-left">Status</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((c, i) => (
              <TR key={c.id} className={selected.has(c.id) ? "bg-linen" : undefined}>
                {editing ? (
                  <TD className="px-2 py-1 text-center">
                    <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="size-4" />
                  </TD>
                ) : null}
                <TD className="tabular px-2 py-1 text-left text-text-muted">{i + 1}</TD>
                <TD className={"px-2 py-1 text-left " + (c.depth ? "pl-7" : "")}>
                  <Link href={`/app/categories/${c.id}`} className={"text-walnut underline " + (c.depth ? "" : "font-semibold")}>
                    {c.depth ? `› ${c.name}` : c.name}
                  </Link>
                </TD>
                <TD className="tabular px-2 py-1 text-left">{c.productCount}</TD>
                <TD className="px-2 py-1 text-left">
                  {c.archived ? <StatusBadge>Archived</StatusBadge> : c.isActive ? <StatusBadge tone="success">Visible</StatusBadge> : <StatusBadge tone="warning">Hidden</StatusBadge>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${ticked.length} ${ticked.length === 1 ? "category" : "categories"}?`}
        description="This permanently deletes the categories. A category that still has products or categories under it is left alone. This cannot be undone. To hide a category and keep it on record, archive it instead."
        confirmLabel="Delete"
        destructive
        pending={deletePending}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
