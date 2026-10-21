"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useEdit } from "@/components/app/edit-mode";
import type { ActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { useResultToast } from "@/components/ui/toaster";

export interface CustomerRow {
  key: string;
  name: string;
  phone: string;
  email: string | null;
  hasAccount: boolean;
  orders: number;
  messages: number;
}

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * The customer list. Press Edit (owner only) to show tick boxes: tick customers, or all of them, then Delete. Deleting asks first and
 * says what goes with each customer. Rows are numbered continuing across pages.
 */
export function CustomersTable({ rows, startAt, total, canDelete, deleteAction }: { rows: CustomerRow[]; startAt: number; total: number; canDelete: boolean; deleteAction: Action }) {
  const { editing, selected, setSelected } = useEdit();
  const [confirm, setConfirm] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await deleteAction(prev, fd);
    if (result.ok) setSelected(new Set());
    return result;
  }, {});
  useResultToast(state);

  const onPage = new Set(rows.map((r) => r.key));
  const ticked = [...selected].filter((k) => onPage.has(k));
  const allTicked = rows.length > 0 && ticked.length === rows.length;
  const chosen = rows.filter((r) => selected.has(r.key));
  const orders = chosen.reduce((n, r) => n + r.orders, 0);
  const messages = chosen.reduce((n, r) => n + r.messages, 0);
  const accounts = chosen.filter((r) => r.hasAccount).length;

  const toggle = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    setSelected(next);
  };

  return (
    <>
      <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-text-muted" role="status">
          {total} {total === 1 ? "customer" : "customers"}
          {editing ? <span> · {ticked.length} selected</span> : null}
        </p>
        {canDelete && editing ? (
          <form ref={form} action={formAction}>
            {ticked.map((k) => (
              <input key={k} type="hidden" name="keys" value={k} />
            ))}
            <Button type="button" variant="danger" disabled={ticked.length === 0 || pending} onClick={() => setConfirm(true)}>
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <TableWrap label="Customers">
        <Table>
          <THead>
            <tr>
              <TH className="w-24 text-left">
                <span className="flex items-center justify-between gap-3">
                  No.
                  {editing ? (
                    <input
                      type="checkbox"
                      aria-label="Select all customers on this page"
                      checked={allTicked}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.key)) : new Set())}
                      className="size-4 accent-[var(--color-walnut)]"
                    />
                  ) : null}
                </span>
              </TH>
              <TH className="min-w-52 text-left">Name</TH>
              <TH className="w-40 text-left">Customer ID</TH>
              <TH className="min-w-40 text-left">Phone</TH>
              <TH className="min-w-56 text-left">Email</TH>
              <TH className="w-32 text-left">Account</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((c, i) => (
              <TR key={c.key} className={selected.has(c.key) ? "bg-linen" : undefined}>
                <TD className="tabular w-24 py-3 align-middle text-text-muted">
                  <span className="flex items-center justify-between gap-3">
                    {startAt + i + 1}
                    {editing ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={selected.has(c.key)}
                        onChange={(e) => toggle(c.key, e.target.checked)}
                        className="size-4 accent-[var(--color-walnut)]"
                      />
                    ) : null}
                  </span>
                </TD>
                <TD className="py-3 align-middle">
                  <Link href={`/app/customers/${c.key}`} className="inline-block border border-border px-2 py-0.5 text-walnut underline">
                    {c.name}
                  </Link>
                </TD>
                <TD className="tabular py-3 align-middle text-text-muted">CUS-{c.key}</TD>
                <TD className="py-3 align-middle">
                  <a className="hover:underline" href={`tel:${c.phone}`}>
                    {c.phone}
                  </a>
                </TD>
                <TD className="py-3 align-middle">
                  {c.email ? (
                    <a className="block max-w-64 truncate hover:underline" href={`mailto:${c.email}`} title={c.email}>
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-text-muted">Not given</span>
                  )}
                </TD>
                <TD className="py-3 align-middle">{c.hasAccount ? "Yes" : <span className="text-text-muted">No</span>}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${ticked.length} ${ticked.length === 1 ? "customer" : "customers"}?`}
        description={`This permanently deletes ${chosen.map((c) => c.name).slice(0, 3).join(", ")}${chosen.length > 3 ? ` and ${chosen.length - 3} more` : ""} with ${orders} ${orders === 1 ? "order" : "orders"} (and their invoices and receipts), ${messages} ${messages === 1 ? "enquiry or quotation" : "enquiries and quotations"} and ${accounts} website ${accounts === 1 ? "account" : "accounts"}. This cannot be undone.`}
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
