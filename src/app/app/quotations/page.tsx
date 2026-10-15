import Link from "next/link";
import { FilterTabs } from "@/components/app/filter-tabs";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { QUOTE_STATUSES, STAFF_QUOTE_LABEL, STAFF_QUOTE_TONE, isQuoteStatus } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listQuotations } from "@/server/messages";

export const metadata = { title: "Quotations" };
const PAGE_SIZE = 20;

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), QUOTE_STATUSES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listQuotations(actor, { status, q, page, pageSize: PAGE_SIZE })]);
  const { counts } = result;
  const href = (over: Record<string, string | undefined>) => buildHref("/app/quotations", { status, q, ...over });
  const tab = (key: (typeof QUOTE_STATUSES)[number] | undefined, label: string, n: number) => ({ label, count: n, active: status === key, href: buildHref("/app/quotations", { status: key, q }) });

  return (
    <>
      <ModuleHeader href="/app/quotations" />
      <FilterTabs
        label="Quotation status"
        tabs={[
          tab(undefined, "All requests", counts.all),
          tab("requested", "New", counts.requested),
          tab("under_review", "Under review", counts.under_review),
          tab("quoted", "Quotations sent", counts.quoted),
          tab("accepted", "Accepted", counts.accepted),
          tab("declined", "Declined", counts.declined + counts.cancelled),
        ]}
      />
      <form method="get" className="app-search mb-6 flex flex-wrap items-end gap-3">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <TextField showOptional={false} label="Search" name="q" type="search" defaultValue={q} placeholder="Reference, name, phone or words in the request" className="min-w-64 flex-1" />
        <Button type="submit">Search</Button>
        {q ? (
          <ButtonLink href={href({ q: undefined })} variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </form>

      {result.rows.length === 0 ? (
        <EmptyState title={q || status ? "No quotations match" : "No quotation requests yet"} description={q || status ? "Try a different tab or search." : "Made-to-measure requests from the website will appear here."} />
      ) : (
        <TableWrap label="Quotations">
          <Table>
            <THead>
              <tr>
                <TH>Request</TH>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Status</TH>
                <TH className="hidden lg:table-cell text-right">Price sent</TH>
                <TH className="hidden lg:table-cell">Received</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((r) => {
                const st = isQuoteStatus(r.quoteStatus) ? r.quoteStatus : "requested";
                const what = (r.payload as { furnitureType?: string | null } | null)?.furnitureType;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/app/messages/${r.id}`} className="font-medium text-walnut underline">
                        {r.reference}
                      </Link>
                      <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">{what ?? r.message ?? "—"}</div>
                    </TD>
                    <TD>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-text-muted">{r.phone}</div>
                      <div className="mt-1 md:hidden">
                        <StatusBadge tone={STAFF_QUOTE_TONE[st]}>{STAFF_QUOTE_LABEL[st]}</StatusBadge>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <StatusBadge tone={STAFF_QUOTE_TONE[st]}>{STAFF_QUOTE_LABEL[st]}</StatusBadge>
                    </TD>
                    <TD numeric className="hidden lg:table-cell">
                      {r.quotedAmount ? formatMoney(r.quotedAmount, business.currency) : <span className="text-text-muted">—</span>}
                    </TD>
                    <TD className="hidden whitespace-nowrap lg:table-cell">{formatDateTime(r.createdAt, business.timezone)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => href({ page: String(n) })} />
    </>
  );
}
