import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { CASE_TONE } from "@/lib/ops-ui";
import { CASE_STATUSES, CASE_STATUS_LABEL, CASE_TYPES, CASE_TYPE_LABEL } from "@/lib/schemas/operations";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, isOverdue } from "@/lib/time";
import { listCases } from "@/server/aftersales";

export const metadata = { title: "After-sales" };

export default async function AfterSalesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), [...CASE_STATUSES, "active"] as const);
  const type = oneOf(one(sp.type), CASE_TYPES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listCases(actor, { status: status ?? (one(sp.status) === "all" ? undefined : "active"), type, q, page, pageSize: 25 })]);
  const effective = status ?? (one(sp.status) === "all" ? "" : "active");
  return (
    <>
      <PageHeader title="After-sales" description="Warranty claims, repairs and complaints. Closing a case needs a written resolution." actions={can(actor, "aftersales:manage") ? <ButtonLink href="/app/after-sales/new">New case</ButtonLink> : undefined} />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference, subject or customer" className="lg:col-span-2" />
        <SelectField label="Status" name="status" showOptional={false} defaultValue={effective} options={[{ value: "active", label: "Open and in progress" }, { value: "all", label: "All" }, ...CASE_STATUSES.map((s) => ({ value: s, label: CASE_STATUS_LABEL[s] }))]} />
        <SelectField label="Type" name="type" showOptional={false} defaultValue={type ?? ""} placeholder="All" options={CASE_TYPES.map((t) => ({ value: t, label: CASE_TYPE_LABEL[t] }))} />
        <div className="flex gap-2"><Button type="submit">Apply</Button></div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "case" : "cases"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title="No cases" description={can(actor, "aftersales:manage") ? "Open a case from a customer's order, or from a customer's page." : "Nothing matches these filters."} />
      ) : (
        <TableWrap label="After-sales cases">
          <Table>
            <THead><tr><TH>Case</TH><TH>Customer</TH><TH>Status</TH><TH className="hidden md:table-cell">Type</TH><TH className="hidden md:table-cell">Due</TH><TH className="hidden lg:table-cell">Assigned to</TH></tr></THead>
            <tbody>
              {result.rows.map((c) => (
                <TR key={c.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/after-sales/${c.id}`}>{c.reference}</Link><span className="line-clamp-1 block text-xs text-text-muted">{c.subject}</span></TD>
                  <TD>{c.customerName}</TD>
                  <TD><StatusBadge tone={CASE_TONE[c.status]}>{CASE_STATUS_LABEL[c.status]}</StatusBadge></TD>
                  <TD className="hidden md:table-cell">{CASE_TYPE_LABEL[c.type]}</TD>
                  <TD className="hidden whitespace-nowrap md:table-cell">{c.dueOn ? formatDate(c.dueOn, business.timezone) : "—"} {c.dueOn && isOverdue(c.dueOn, c.status === "resolved" || c.status === "closed", business.timezone) ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}</TD>
                  <TD className="hidden lg:table-cell">{c.assigneeName ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/after-sales", { q, status: effective, type, page: String(n) })} />
    </>
  );
}
