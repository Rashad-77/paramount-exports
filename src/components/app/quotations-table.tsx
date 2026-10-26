"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import { EnquiryTag } from "@/components/app/tags";
import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyRow, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { useResultToast } from "@/components/ui/toaster";

export interface QuotationRow {
  id: string;
  /** QUO-000004 */
  reference: string;
  summary: string;
  name: string;
  phone: string;
  handled: boolean;
  createdIso: string;
  createdText: string;
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * The quotation list. Press Edit (owner only) to show tick boxes: tick quotations, or all of them on the page, then Delete. Deleting asks
 * first. Rows are numbered continuing across pages.
 */
export function QuotationsTable({ rows, startAt, total, canDelete, deleteAction, empty }: { rows: QuotationRow[]; startAt: number; total: number; canDelete: boolean; deleteAction: Action; empty: { title: string; description: string } }) {
  const { editing, selected, setSelected } = useEdit();
  const [confirm, setConfirm] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await deleteAction(prev, fd);
    if (result.ok) setSelected(new Set());
    return result;
  }, {});
  useResultToast(state);

  const onPage = new Set(rows.map((r) => r.id));
  const ticked = [...selected].filter((k) => onPage.has(k));
  const allTicked = rows.length > 0 && ticked.length === rows.length;
  const chosen = rows.filter((r) => selected.has(r.id));

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  return (
    <>
      {canDelete && editing ? (
        <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-text-muted" role="status">
            {total} {total === 1 ? "quotation" : "quotations"} · {ticked.length} selected
          </p>
          <form ref={form} action={formAction}>
            {ticked.map((k) => (
              <input key={k} type="hidden" name="ids" value={k} />
            ))}
            <Button type="button" variant="danger" disabled={ticked.length === 0 || pending} onClick={() => setConfirm(true)}>
              Delete
            </Button>
          </form>
        </div>
      ) : null}

      <TableWrap label="Quotations">
        <Table>
          <THead>
            <tr>
              <TH className="w-24">
                <span className="flex items-center justify-center gap-3">
                  No.
                  {canDelete && editing ? (
                    <input
                      type="checkbox"
                      aria-label="Select all quotations on this page"
                      checked={allTicked}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      className="size-4 accent-[var(--color-walnut)]"
                    />
                  ) : null}
                </span>
              </TH>
              <TH>Request</TH>
              <TH>Customer</TH>
              <TH className="w-44">Status</TH>
            </tr>
          </THead>
          <tbody>
            {rows.length === 0 ? <EmptyRow colSpan={4} title={empty.title} description={empty.description} /> : null}
            {rows.map((r, i) => (
              <TR key={r.id} className={selected.has(r.id) ? "bg-linen" : undefined}>
                <TD className="tabular text-center text-text-muted">
                  <span className="flex items-center justify-center gap-3">
                    {startAt + i + 1}
                    {canDelete && editing ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.reference}`}
                        checked={selected.has(r.id)}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="size-4 accent-[var(--color-walnut)]"
                      />
                    ) : null}
                  </span>
                </TD>
                <TD>
                  <Link href={`/app/messages/${r.id}`} className="font-medium text-walnut underline">
                    {r.reference}
                  </Link>
                  <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">{r.summary}</div>
                </TD>
                <TD>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-text-muted">{r.phone}</div>
                </TD>
                <TD className="w-44 min-w-[11rem] whitespace-nowrap text-center">
                  <div className="relative flex flex-col items-center">
                    <EnquiryTag state={r.handled ? "responded" : "new"} />
                    <time dateTime={r.createdIso} className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-[0.65rem] leading-none whitespace-nowrap text-text-muted">
                      {r.createdText}
                    </time>
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${ticked.length} ${ticked.length === 1 ? "quotation" : "quotations"}?`}
        description={`This permanently deletes ${chosen.map((c) => c.reference).slice(0, 4).join(", ")}${chosen.length > 4 ? ` and ${chosen.length - 4} more` : ""}, with their replies. It cannot be undone.`}
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
