import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission, scopeOf } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { FLOW, JOB_STAGES, PRIORITY_LABEL, PRIORITY_TONE, STAGE_LABEL, STAGE_TONE, type JobStage } from "@/lib/production";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listBoard, listJobs } from "@/server/production";

export const metadata = { title: "Production jobs" };

type JobRow = Awaited<ReturnType<typeof listBoard>>["rows"][number];

function JobCard({ j, tz }: { j: JobRow; tz: string }) {
  return (
    <li className=" border border-border bg-surface p-3">
      <Link href={`/app/production/${j.id}`} className="block min-h-11 font-medium text-walnut underline">
        {j.reference}
      </Link>
      <p className="mt-1 line-clamp-2 text-sm">{j.description}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {j.priority !== "normal" ? <StatusBadge tone={PRIORITY_TONE[j.priority]}>{PRIORITY_LABEL[j.priority]}</StatusBadge> : null}
        {j.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
        {j.openIssues > 0 ? <StatusBadge tone="warning">{j.openIssues} open {j.openIssues === 1 ? "issue" : "issues"}</StatusBadge> : null}
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {j.targetDate ? `Due ${formatDate(j.targetDate, tz)}` : "No due date"} · {j.assignees ?? "Unassigned"}
      </p>
    </li>
  );
}

export default async function ProductionPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "production:view");
  const sp = await searchParams;
  const view = one(sp.view) === "list" ? "list" : "board";
  const own = scopeOf(actor, "production:view") === "own";
  const business = await getBusinessSettings();

  const header = (
    <PageHeader
      title={own ? "My jobs" : "Production jobs"}
      description={own ? "Jobs assigned to you. Open a job to update its stage, record materials used or report a problem." : "Custom orders in the workshop. A job is created automatically when a custom order is confirmed."}
      actions={
        <>
          <ButtonLink href={buildHref("/app/production", {})} variant={view === "board" ? "primary" : "secondary"} aria-current={view === "board" ? "page" : undefined}>Board</ButtonLink>
          <ButtonLink href={buildHref("/app/production", { view: "list" })} variant={view === "list" ? "primary" : "secondary"} aria-current={view === "list" ? "page" : undefined}>List</ButtonLink>
        </>
      }
    />
  );

  if (view === "board") {
    const { rows } = await listBoard(actor);
    if (rows.length === 0) {
      return (
        <>
          {header}
          <EmptyState title={own ? "No jobs assigned to you" : "No active jobs"} description={own ? "A manager assigns jobs to you." : "Confirm a custom order and its job appears here."} />
        </>
      );
    }
    const columns: JobStage[] = [...FLOW, "on_hold"];
    return (
      <>
        {header}
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((stage) => {
            const jobs = rows.filter((r) => r.stage === stage);
            return (
              <section key={stage} aria-labelledby={`col-${stage}`} className="min-w-0 border border-border bg-linen/50 p-3">
                <h2 id={`col-${stage}`} className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold">
                  {STAGE_LABEL[stage]}
                  <span className="border border-border bg-surface px-2 py-0.5 text-xs text-text-muted">{jobs.length}</span>
                </h2>
                {jobs.length === 0 ? <p className="px-1 py-3 text-sm text-text-muted">Nothing here.</p> : <ul className="space-y-2">{jobs.map((j) => <JobCard key={j.id} j={j} tz={business.timezone} />)}</ul>}
              </section>
            );
          })}
        </div>
      </>
    );
  }

  const stage = oneOf(one(sp.stage), JOB_STAGES);
  const q = one(sp.q)?.slice(0, 80);
  const mine = !own && one(sp.mine) === "1";
  const overdue = one(sp.overdue) === "1";
  const page = pageOf(sp);
  const result = await listJobs(actor, { stage, q, assignee: mine ? "me" : undefined, overdueOnly: overdue, page, pageSize: 25 });
  const filtered = Boolean(stage || q || mine || overdue);
  return (
    <>
      {header}
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <input type="hidden" name="view" value="list" />
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference or description" className="lg:col-span-2" />
        <SelectField label="Stage" name="stage" showOptional={false} defaultValue={stage ?? ""} placeholder="All" options={JOB_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} />
        <div className="flex flex-col gap-1">
          {!own ? <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5 accent-[var(--color-walnut)]" /> Assigned to me</label> : null}
          <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="size-5 accent-[var(--color-walnut)]" /> Overdue only</label>
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Apply</Button>
          {filtered ? <ButtonLink href="/app/production?view=list" variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "job" : "jobs"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No jobs match" : "No jobs yet"} description={filtered ? "Try clearing a filter." : "Jobs are created when a custom order is confirmed."} />
      ) : (
        <TableWrap label="Production jobs">
          <Table>
            <THead>
              <tr>
                <TH>Job</TH>
                <TH>Description</TH>
                <TH>Stage</TH>
                <TH className="hidden md:table-cell">Priority</TH>
                <TH className="hidden md:table-cell">Due</TH>
                <TH className="hidden lg:table-cell">Assigned to</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((j) => (
                <TR key={j.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/production/${j.id}`}>{j.reference}</Link></TD>
                  <TD className="max-w-xs"><span className="line-clamp-2">{j.description}</span></TD>
                  <TD><StatusBadge tone={STAGE_TONE[j.stage]}>{STAGE_LABEL[j.stage]}</StatusBadge></TD>
                  <TD className="hidden md:table-cell">{PRIORITY_LABEL[j.priority]}</TD>
                  <TD className="hidden whitespace-nowrap md:table-cell">
                    {j.targetDate ? formatDate(j.targetDate, business.timezone) : "—"} {j.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}
                  </TD>
                  <TD className="hidden lg:table-cell">{j.assignees ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/production", { view: "list", q, stage, mine: mine ? "1" : undefined, overdue: overdue ? "1" : undefined, page: String(n) })} />
    </>
  );
}
