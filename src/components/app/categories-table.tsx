"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { useResultToast } from "@/components/ui/toaster";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import type { ActionState } from "@/lib/action-state";

export interface CategoryRow {
  id: string;
  name: string;
  /** 1, 2, 3 for main categories and 1.1, 1.2 for the subcategories under them. */
  number: string;
  parentId: string | null;
  /** A subcategory (shown in the Subcategory column). */
  depth: 0 | 1;
  /** The main category a subcategory sits under. */
  groupName: string | null;
  /** Whether to name the main category on this row: not when it or a sibling is the row just above. */
  showGroup: boolean;
  productCount: number;
  /** What shows in the Status column: a subcategory follows its main category when that is hidden or archived. */
  status: "visible" | "hidden" | "archived";
  inherited: boolean;
  /** Its own hidden state (not what it inherits). */
  isActive: boolean;
  /** Its own archived state, which is what Archive and Restore act on. */
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
  // Which buttons show depends on the state of the ticked rows themselves: visible, hidden or archived.
  const kinds = new Set<string>(rows.filter((r) => selected.has(r.id)).map((r) => (r.archived ? "archived" : r.isActive ? "visible" : "hidden")));
  const only = (k: string) => kinds.size === 1 && kinds.has(k);
  const idle = kinds.size === 0; // nothing ticked: every button shows, greyed out
  const canHide = idle || only("visible");
  const canRestore = idle || !only("visible");
  const canArchive = !only("archived");
  const tickedSubs = rows.filter((r) => selected.has(r.id) && r.depth === 1).length;
  const tickedMain = ticked.length - tickedSubs;
  const deleteWhat = [
    tickedMain > 0 ? `${tickedMain} ${tickedMain === 1 ? "category" : "categories"}` : "",
    tickedSubs > 0 ? `${tickedSubs} ${tickedSubs === 1 ? "subcategory" : "subcategories"}` : "",
  ]
    .filter(Boolean)
    .join(" and ");
  const tickedRows = rows.filter((r) => selected.has(r.id));
  const shortList = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`);
  const nameList = (names: string[]) => (names.length <= 4 ? names.join(", ") : `${names.slice(0, 4).join(", ")} and ${names.length - 4} more`);
  // Delete is unavailable while something ticked still has products, or a ticked main category still has subcategories that are not ticked.
  const withProducts = tickedRows.filter((r) => r.productCount > 0).map((r) => r.name);
  const withSubs = tickedRows.filter((r) => r.depth === 0 && rows.some((k) => k.parentId === r.id && !selected.has(k.id))).map((r) => r.name);
  const deleteBlocked = [
    withProducts.length ? `${shortList(withProducts)} ${withProducts.length === 1 ? "has" : "have"} products.` : "",
    withSubs.length ? `${shortList(withSubs)} ${withSubs.length === 1 ? "has" : "have"} subcategories not ticked.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const deleteDescription = `${nameList(tickedRows.map((r) => r.name))} will be permanently deleted. This cannot be undone.`;
  const busy = archivePending || deletePending;
  useResultToast(deleteState);
  useResultToast(archiveState);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    // Ticking a main category ticks the subcategories under it too (and unticking clears them).
    const ids = [id, ...rows.filter((r) => r.parentId === id).map((r) => r.id)];
    for (const i of ids) {
      if (on) next.add(i);
      else next.delete(i);
    }
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
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            {deleteBlocked ? (
              <span className="min-w-0 flex-1 truncate text-right text-sm text-danger" title={deleteBlocked} role="status">
                Cannot delete: {deleteBlocked}
              </span>
            ) : null}
            {canHide ? (
              <form action={archiveForm}>
                {idInputs}
                <input type="hidden" name="mode" value="hide" />
                <Button type="submit" variant="secondary" disabled={idle || busy}>
                  Hide
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
              <Button type="button" variant="danger" disabled={ticked.length === 0 || busy || Boolean(deleteBlocked)} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </form>
          </div>
        ) : null}
      </div>


      <TableWrap label="Categories">
        <Table>
          <THead>
            <tr>
              <TH className="w-24 px-2 py-1.5 text-left border-r border-border-strong/50 last:border-r-0">
                <span className="flex items-center justify-between gap-3">
                  No.
                  {editing ? (
                    <input
                      type="checkbox"
                      aria-label="Select all categories"
                      checked={allTicked}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      className="size-4"
                    />
                  ) : null}
                </span>
              </TH>
              <TH className="px-2 py-1.5 text-left border-r border-border-strong/50 last:border-r-0">Category</TH>
              <TH className="px-2 py-1.5 text-left border-r border-border-strong/50 last:border-r-0">Subcategory</TH>
              <TH className="px-2 py-1.5 text-left border-r border-border-strong/50 last:border-r-0">Products</TH>
              <TH className="px-2 py-1.5 border-r border-border-strong/50 last:border-r-0">
                <span className="flex justify-center">Status</span>
              </TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((c) => (
              <TR key={c.id} className={(selected.has(c.id) ? "bg-linen " : "") + "border-b border-border-strong/50" + (c.depth === 0 ? " border-t-2 border-border-strong/50" : "")}>
                <TD className={"tabular px-2 py-1 text-left border-r border-border-strong/50 last:border-r-0 " + (c.depth ? "text-text-muted" : "font-medium")}>
                  <span className="flex items-center justify-between gap-3">
                    {c.number}
                    {editing ? <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} className="size-4" /> : null}
                  </span>
                </TD>
                <TD className="px-2 py-1 text-left border-r border-border-strong/50 last:border-r-0">
                  {c.depth ? (
                    c.showGroup && c.groupName ? <span className="text-text-muted">{c.groupName}</span> : null
                  ) : (
                    <Link href={`/app/categories/${c.id}`} className="font-normal text-walnut underline">
                      {c.name}
                    </Link>
                  )}
                </TD>
                <TD className="px-2 py-1 text-left border-r border-border-strong/50 last:border-r-0">
                  {c.depth ? (
                    <Link href={`/app/categories/${c.id}`} className="text-walnut underline">
                      {c.name}
                    </Link>
                  ) : null}
                </TD>
                <TD className="tabular px-2 py-1 text-left border-r border-border-strong/50 last:border-r-0">{c.productCount}</TD>
                <TD className="px-2 py-1 border-r border-border-strong/50 last:border-r-0">
                  <span className="flex justify-center" title={c.inherited ? `Follows ${c.groupName ?? "its main category"}` : undefined}>
                    {c.status === "archived" ? (
                      <StatusBadge className="!border-[#475569] !bg-[#475569] !text-white">Archived</StatusBadge>
                    ) : c.status === "visible" ? (
                      <StatusBadge tone="success" className="!border-[#15803d] !bg-[#15803d] !text-white">Visible</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning" className="!border-[#b45309] !bg-[#b45309] !text-white">Hidden</StatusBadge>
                    )}
                  </span>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${deleteWhat}?`}
        description={deleteDescription}
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
