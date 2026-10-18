"use client";

import { Crown, Star } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { useResultToast } from "@/components/ui/toaster";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import type { ActionState } from "@/lib/action-state";

export interface ProductRow {
  id: string;
  name: string;
  categoryName: string;
  isPublished: boolean;
  isFeatured: boolean;
  isPremium: boolean;
  archived: boolean;
  availability: string | null;
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * The staff product list. Press Edit to show tick boxes: tick products (or all of them), then Archive (or Restore) or Delete them.
 * Deleting asks first. Rows are numbered continuing across pages.
 */
export function ProductsTable({
  rows,
  startAt,
  total,
  canWrite,
  archiveAction,
  deleteAction,
}: {
  rows: ProductRow[];
  startAt: number;
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
  // Only rows still on the page can stay ticked.
  const onPage = new Set(rows.map((r) => r.id));
  const ticked = [...selected].filter((id) => onPage.has(id));
  const allTicked = rows.length > 0 && ticked.length === rows.length;
  // Which buttons show depends on the ticked rows themselves: published, draft or archived.
  const kinds = new Set<string>(rows.filter((r) => selected.has(r.id)).map((r) => (r.archived ? "archived" : r.isPublished ? "published" : "draft")));
  const only = (k: string) => kinds.size === 1 && kinds.has(k);
  const idle = kinds.size === 0; // nothing ticked: every button shows, greyed out
  const canUnpublish = idle || only("published");
  const canRestore = idle || kinds.has("archived");
  const canArchive = !only("archived");
  const busy = archivePending || deletePending;
  useResultToast(deleteState);
  useResultToast(archiveState);

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
          {total} {total === 1 ? "product" : "products"}
          {editing ? <span> · {ticked.length} selected</span> : null}
        </p>
        {canWrite && editing ? (
          <div className="flex flex-wrap items-center gap-3">
            {editing ? (
              <>
                {canUnpublish ? (
                <form action={archiveForm}>
                  {idInputs}
                  <input type="hidden" name="mode" value="unpublish" />
                  <Button type="submit" variant="secondary" disabled={idle || busy}>
                    Unpublish
                  </Button>
                </form>
                ) : null}
                {canRestore ? (
                <form action={archiveForm}>
                  {idInputs}
                  <input type="hidden" name="mode" value="restore" />
                  <Button type="submit" variant="secondary" disabled={idle || busy}>
                    Restore
                  </Button>
                </form>
                ) : null}
                {canArchive ? (
                <form action={archiveForm}>
                  {idInputs}
                  <input type="hidden" name="mode" value="archive" />
                  <Button type="submit" variant="secondary" disabled={ticked.length === 0 || busy}>
                    Archive
                  </Button>
                </form>
                ) : null}
                <form ref={deleteRef} action={deleteForm}>
                  {idInputs}
                  <Button type="button" variant="danger" disabled={ticked.length === 0 || busy} onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                </form>
              </>
            ) : null}
          </div>
        ) : null}
      </div>


      <TableWrap label="Products">
        <Table>
          <THead>
            <tr>
              <TH className="w-24 px-2 py-1.5 text-left">
                <span className="flex items-center justify-between gap-3">
                  No.
                  {editing ? (
                    <input
                      type="checkbox"
                      aria-label="Select all products on this page"
                      checked={allTicked}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      className="size-4 accent-[var(--color-walnut)]"
                    />
                  ) : null}
                </span>
              </TH>
              <TH className="px-2 py-1.5 text-left">Product</TH>
              <TH className="px-2 py-1.5 text-left">Category</TH>
              <TH className="px-2 py-1.5 text-left">Status</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((p, i) => (
              <TR key={p.id} className={selected.has(p.id) ? "bg-linen" : undefined}>
                <TD className="tabular px-2 py-1 text-left text-text-muted">
                  <span className="flex items-center justify-between gap-3">
                    {startAt + i + 1}
                    {editing ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.name}`}
                        checked={selected.has(p.id)}
                        onChange={(e) => toggle(p.id, e.target.checked)}
                        className="size-4 accent-[var(--color-walnut)]"
                      />
                    ) : null}
                  </span>
                </TD>
                <TD className="px-2 py-1 text-left">
                  <Link href={`/app/products/${p.id}`} className="font-medium text-walnut underline">
                    {p.name}
                  </Link>
                </TD>
                <TD className="px-2 py-1 text-left">{p.categoryName}</TD>
                <TD className="px-2 py-1 text-left">
                  <div className="flex flex-wrap items-center gap-1">
                    {p.archived ? <StatusBadge>Archived</StatusBadge> : p.isPublished ? <StatusBadge tone="success">Published</StatusBadge> : <StatusBadge tone="warning">Draft</StatusBadge>}
                    {p.isFeatured && !p.archived ? (
                      <span data-tip="Featured" className="inline-flex size-6 items-center justify-center border border-border-strong text-text-muted">
                        <Star aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">Featured</span>
                      </span>
                    ) : null}
                    {p.isPremium && !p.archived ? (
                      <span data-tip="Premium" className="inline-flex size-6 items-center justify-center border border-border-strong text-text-muted">
                        <Crown aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">Premium</span>
                      </span>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${ticked.length} ${ticked.length === 1 ? "product" : "products"}?`}
        description="This permanently deletes the products with their photos. Orders and quotations keep the names and prices they were placed with. This cannot be undone. To hide a product and keep it on record, archive it instead."
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
