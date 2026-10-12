import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge, type Tone } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { QUOTATION_STATUSES, QUOTATION_STATUS_LABEL, type QuotationStatus } from "@/lib/schemas/quotation";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listQuotations } from "@/server/quotations";

export const metadata = { title: "Quotations" };

export const QUOTATION_TONE: Record<QuotationStatus, Tone> = { draft: "neutral", sent: "info", accepted: "success", rejected: "danger", expired: "warning", converted: "success" };

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), QUOTATION_STATUSES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listQuotations(actor, { status, q, page, pageSize: 25 })]);
  const filtered = Boolean(status || q);
  return (
    <>
      <PageHeader title="Quotations" description="Drafts, quotations awaiting a reply, and decided ones." actions={can(actor, "quotations:write") ? <ButtonLink href="/app/quotations/new">New quotation</ButtonLink> : undefined} />
      <form method="get" className="mb-6 grid gap-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 sm:grid-cols-3 sm:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference or customer" />
        <SelectField label="Status" name="status" showOptional={false} defaultValue={status ?? ""} placeholder="All" options={QUOTATION_STATUSES.map((s) => ({ value: s, label: QUOTATION_STATUS_LABEL[s] }))} />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          {filtered ? <ButtonLink href="/app/quotations" variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "quotation" : "quotations"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No quotations match" : "No quotations yet"} description={filtered ? "Try clearing a filter." : "Start one from a customer or an enquiry."} />
      ) : (
        <TableWrap label="Quotations">
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
                <TH className="hidden md:table-cell">Valid until</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/app/quotations/${r.id}`} className="font-medium text-walnut underline">{r.reference}</Link>
                    {r.revisionNo > 1 ? <span className="ml-1 text-text-muted">rev {r.revisionNo}</span> : null}
                  </TD>
                  <TD>{r.customerName}</TD>
                  <TD>
                    <StatusBadge tone={QUOTATION_TONE[r.status]}>{QUOTATION_STATUS_LABEL[r.status]}</StatusBadge>
                    {r.pastValidity ? <div className="mt-1"><StatusBadge tone="warning">Past valid-until date</StatusBadge></div> : null}
                  </TD>
                  <TD numeric>{formatMoney(r.total, r.currency)}</TD>
                  <TD className="hidden whitespace-nowrap md:table-cell">{formatDate(r.validUntil, business.timezone)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/quotations", { q, status, page: String(n) })} />
    </>
  );
}
