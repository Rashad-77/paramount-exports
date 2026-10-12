import Link from "next/link";
import { Check } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listFollowUps } from "@/server/crm";
import { completeFollowUpAction } from "../leads/crm-actions";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const assignee = oneOf(one(sp.who), ["me", "all"] as const) ?? "me";
  const status = oneOf(one(sp.status), ["open", "overdue", "done"] as const) ?? "open";
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listFollowUps(actor, { assignee, status, page, pageSize: 25 })]);
  const href = (over: Record<string, string | undefined>) => buildHref("/app/follow-ups", { who: assignee, status, ...over });
  const tab = (label: string, active: boolean, to: string) => (
    <Link href={to} aria-current={active ? "page" : undefined} className={"inline-flex min-h-10 items-center border px-4 text-sm " + (active ? "border-walnut bg-walnut text-ivory" : "border-border-strong hover:bg-linen")}>
      {label}
    </Link>
  );
  return (
    <>
      <ModuleHeader href="/app/follow-ups" />
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filters">
        {tab("Mine", assignee === "me", href({ who: "me", page: undefined }))}
        {tab("Everyone", assignee === "all", href({ who: "all", page: undefined }))}
        <span className="mx-2 hidden w-px bg-border sm:block" aria-hidden="true" />
        {tab("Open", status === "open", href({ status: "open", page: undefined }))}
        {tab("Overdue", status === "overdue", href({ status: "overdue", page: undefined }))}
        {tab("Done", status === "done", href({ status: "done", page: undefined }))}
      </div>
      {result.rows.length === 0 ? (
        <EmptyState title={status === "overdue" ? "Nothing is overdue" : status === "done" ? "Nothing completed yet" : "No open follow-ups"} description="Add follow-ups from an enquiry or customer page." action={<ButtonLink href="/app/leads" variant="secondary">Go to enquiries</ButtonLink>} />
      ) : (
        <TableWrap label="Follow-ups">
          <Table>
            <THead>
              <tr>
                <TH>Task</TH>
                <TH>Due</TH>
                <TH className="hidden md:table-cell">For</TH>
                <TH className="hidden md:table-cell">Assigned to</TH>
                <TH>{status === "done" ? "Status" : "Action"}</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <div className={t.completedAt ? "text-text-muted line-through" : "font-medium"}>{t.title}</div>
                    {t.notes ? <div className="text-text-muted">{t.notes}</div> : null}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {formatDate(t.dueOn, business.timezone)}
                    {t.overdue ? <div className="mt-1"><StatusBadge tone="danger">Overdue</StatusBadge></div> : null}
                  </TD>
                  <TD className="hidden md:table-cell">
                    {t.leadId ? <Link className="underline" href={`/app/leads/${t.leadId}`}>{t.leadReference} · {t.leadName}</Link> : t.customerId ? <Link className="underline" href={`/app/customers/${t.customerId}`}>{t.customerName}</Link> : "—"}
                  </TD>
                  <TD className="hidden md:table-cell">{t.assigneeName}</TD>
                  <TD>
                    {t.completedAt ? (
                      <StatusBadge tone="success">Done</StatusBadge>
                    ) : (
                      <ActionForm action={completeFollowUpAction} className="space-y-0">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="leadId" value={t.leadId ?? ""} />
                        <input type="hidden" name="customerId" value={t.customerId ?? ""} />
                        <Button type="submit" variant="secondary" aria-label={`Mark “${t.title}” done`}>
                          <Check aria-hidden="true" className="size-4" /> Done
                        </Button>
                      </ActionForm>
                    )}
                  </TD>
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
