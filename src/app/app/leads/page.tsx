import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { SelectField, TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_STATUS_TONE, LEAD_KIND_LABEL } from "@/lib/crm";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listAssignableStaff, listLeads } from "@/server/leads";

export const metadata = { title: "Enquiries" };
const PAGE_SIZE = 20;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), [...LEAD_STATUSES, "open"] as const);
  const source = oneOf(one(sp.source), LEAD_SOURCES);
  const assignedTo = one(sp.assignedTo);
  const q = one(sp.q)?.slice(0, 80);
  const sort = oneOf(one(sp.sort), ["newest", "oldest", "followup"] as const) ?? "newest";
  const page = pageOf(sp);

  const [business, staff, result] = await Promise.all([
    getBusinessSettings(),
    listAssignableStaff(actor),
    listLeads(actor, { status, source, assignedTo, q, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const href = (over: Record<string, string | undefined>) => buildHref("/app/leads", { status, source, assignedTo, q, sort: sort === "newest" ? undefined : sort, ...over });
  const filtered = Boolean(status || source || assignedTo || q);

  return (
    <>
      <ModuleHeader href="/app/leads" actions={can(actor, "leads:write") ? <ButtonLink href="/app/leads/new">Record enquiry</ButtonLink> : undefined} />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <TextField showOptional={false} label="Search" name="q" type="search" defaultValue={q} placeholder="Name, phone, email, ref" className="lg:col-span-2" />
        <SelectField showOptional={false} label="Status" name="status" defaultValue={status ?? ""} placeholder="All" options={[{ value: "open", label: "Open (not won/lost)" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))]} />
        <SelectField showOptional={false} label="Source" name="source" defaultValue={source ?? ""} placeholder="All" options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABEL[s] }))} />
        <SelectField
          showOptional={false}
          label="Assigned to"
          name="assignedTo"
          defaultValue={assignedTo ?? ""}
          placeholder="Anyone"
          options={[{ value: "me", label: "Me" }, { value: "unassigned", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <SelectField showOptional={false} label="Sort" name="sort" defaultValue={sort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "followup", label: "Next follow-up" }]} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Apply filters</Button>
          {filtered ? <ButtonLink href="/app/leads" variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>

      <p className="mb-3 text-sm text-text-muted" role="status">
        {result.total} {result.total === 1 ? "enquiry" : "enquiries"}
      </p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No enquiries match those filters" : "No enquiries yet"} description={filtered ? "Try clearing a filter." : "Enquiries sent from the website will appear here."} />
      ) : (
        <TableWrap label="Enquiries">
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH>Contact</TH>
                <TH className="hidden lg:table-cell">Type</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="hidden md:table-cell">Assigned to</TH>
                <TH className="hidden lg:table-cell">Received</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link href={`/app/leads/${r.id}`} className="font-medium text-walnut underline">
                      {r.reference}
                    </Link>
                  </TD>
                  <TD>
                    <div className="font-medium">{r.contactName}</div>
                    <div className="text-text-muted">{r.contactPhone}</div>
                    <div className="mt-1 md:hidden">
                      <StatusBadge tone={LEAD_STATUS_TONE[r.status]}>{LEAD_STATUS_LABEL[r.status]}</StatusBadge>
                    </div>
                    {r.hasDuplicate ? <StatusBadge tone="warning" className="mt-1">Possible existing customer</StatusBadge> : null}
                  </TD>
                  <TD className="hidden lg:table-cell">{LEAD_KIND_LABEL[r.kind] ?? r.kind}</TD>
                  <TD className="hidden md:table-cell">
                    <StatusBadge tone={LEAD_STATUS_TONE[r.status]}>{LEAD_STATUS_LABEL[r.status]}</StatusBadge>
                  </TD>
                  <TD className="hidden md:table-cell">{r.assigneeName ?? <span className="text-text-muted">Unassigned</span>}</TD>
                  <TD className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(r.createdAt, business.timezone)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => href({ page: String(n) })} />
    </>
  );
}
