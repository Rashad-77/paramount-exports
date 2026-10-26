"use client";

import Link from "next/link";
import { useEdit } from "@/components/app/edit-mode";
import { EnquiryTag } from "@/components/app/tags";
import { EmptyRow, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";

export interface MessageRow {
  id: string;
  /** QUO-000004 or MSG-000012 */
  reference: string;
  summary: string;
  name: string;
  phone: string;
  handled: boolean;
  createdIso: string;
  createdText: string;
}

/**
 * The quotation and enquiry lists. Press Edit (owner only; the button is in the page header, with Delete next to it) to show a tick box
 * on each row. Rows are numbered continuing across pages.
 */
export function MessagesTable({ rows, startAt, canDelete, label, requestHeading, empty }: { rows: MessageRow[]; startAt: number; canDelete: boolean; label: string; requestHeading: string; empty: { title: string; description: string } }) {
  const { editing, selected, setSelected } = useEdit();
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  return (
    <TableWrap label={label}>
      <Table>
        <THead>
          <tr>
            <TH className="w-16">No.</TH>
            <TH>{requestHeading}</TH>
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
  );
}
