"use client";

import { Crown, Star } from "lucide-react";
import Link from "next/link";
import { createContext, useActionState, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert, StatusBadge } from "@/components/ui/status";
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

const EditCtx = createContext<{ editing: boolean; selected: Set<string>; setSelected: (s: Set<string>) => void; toggleEditing: () => void } | null>(null);
const useEdit = () => {
  const c = useContext(EditCtx);
  if (!c) throw new Error("Wrap the product list in ProductsEditProvider.");
  return c;
};

/** Shares edit mode between the Edit button in the page header and the list below. */
export function ProductsEditProvider({ children }: { children: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <EditCtx.Provider
      value={{
        editing,
        selected,
        setSelected,
        toggleEditing: () => {
          setEditing((e) => !e);
          setSelected(new Set());
        },
      }}
    >
      {children}
    </EditCtx.Provider>
  );
}

/** The Edit / Done button, placed next to Add product. */
export function EditToggle() {
  const { editing, toggleEditing } = useEdit();
  return (
    <Button type="button" variant={editing ? "primary" : "secondary"} onClick={toggleEditing}>
      {editing ? "Done" : "Edit"}
    </Button>
  );
}

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
          {total} {total === 1 ? "product" : "products"}
          {editing ? <span> · {ticked.length} selected</span> : null}
        </p>
        {canWrite && editing ? (
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
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
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? (
        <div className="mb-3">
          <Alert tone={message.error ? "danger" : "success"}>{message.error ?? message.message}</Alert>
        </div>
      ) : null}

      <TableWrap label="Products">
        <Table>
          <THead>
            <tr>
              {editing ? (
                <TH className="w-10 px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all products on this page"
                    checked={allTicked}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                    className="size-4 accent-[var(--color-walnut)]"
                  />
                </TH>
              ) : null}
              <TH className="w-12 px-2 py-1.5 text-left">No.</TH>
              <TH className="px-2 py-1.5 text-left">Product</TH>
              <TH className="px-2 py-1.5 text-left">Category</TH>
              <TH className="px-2 py-1.5 text-left">Status</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((p, i) => (
              <TR key={p.id} className={selected.has(p.id) ? "bg-linen" : undefined}>
                {editing ? (
                  <TD className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={(e) => toggle(p.id, e.target.checked)}
                      className="size-4 accent-[var(--color-walnut)]"
                    />
                  </TD>
                ) : null}
                <TD className="tabular px-2 py-1 text-left text-text-muted">{startAt + i + 1}</TD>
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
