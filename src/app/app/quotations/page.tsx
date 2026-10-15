import { QuoteTag } from "@/components/app/tags";
import Link from "next/link";
import { ListSearch } from "@/components/app/list-search";
import { FilterTabs } from "@/components/app/filter-tabs";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import {
  Pagination,
  Table,
  TableWrap,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { formatAmount } from "@/lib/money";
import { QUOTE_STATUSES, isQuoteStatus } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listQuotations } from "@/server/messages";

export const metadata = { title: "Quotations" };
const PAGE_SIZE = 20;

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const status = oneOf(one(sp.status), QUOTE_STATUSES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listQuotations(actor, { status, q, page, pageSize: PAGE_SIZE }),
  ]);
  const { counts } = result;
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/quotations", { status, q, ...over });
  const tab = (
    key: (typeof QUOTE_STATUSES)[number] | undefined,
    label: string,
    n: number,
  ) => ({
    label,
    count: n,
    active: status === key,
    href: buildHref("/app/quotations", { status: key, q }),
  });

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
      <ListSearch
        action="/app/quotations"
        params={{ status }}
        q={q}
        placeholder="Reference, name, phone or words in the request"
      />
      <div className="app-results">
        {result.rows.length === 0 ? (
          <EmptyState
            title={
              q || status ? "No quotations match" : "No quotation requests yet"
            }
            description={
              q || status
                ? "Try a different tab or search."
                : "Made-to-measure requests from the website will appear here."
            }
          />
        ) : (
          <TableWrap label="Quotations">
            <Table>
              <THead>
                <tr>
                  <TH>Request</TH>
                  <TH>Customer</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Price sent</TH>
                  <TH>Received</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((r) => {
                  const st = isQuoteStatus(r.quoteStatus)
                    ? r.quoteStatus
                    : "requested";
                  const what = (
                    r.payload as { furnitureType?: string | null } | null
                  )?.furnitureType;
                  return (
                    <TR key={r.id}>
                      <TD>
                        <Link
                          href={`/app/messages/${r.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {r.reference}
                        </Link>
                        <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">
                          {what ?? r.message ?? "—"}
                        </div>
                      </TD>
                      <TD>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-text-muted">{r.phone}</div>
                        <div className="mt-1 md:hidden">
                          <QuoteTag status={st} />
                        </div>
                      </TD>
                      <TD>
                        <QuoteTag status={st} />
                      </TD>
                      <TD numeric>
                        {r.quotedAmount ? (
                          formatAmount(r.quotedAmount)
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap">
                        {formatDateTime(r.createdAt, business.timezone)}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination
          page={page}
          pageCount={result.pageCount}
          hrefFor={(n) => href({ page: String(n) })}
        />
      </div>
    </>
  );
}
