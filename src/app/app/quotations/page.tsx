import { EnquiryTag } from "@/components/app/tags";
import { plainPhone } from "@/lib/contact";
import Link from "next/link";
import { ListFilters } from "@/components/app/list-filters";
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
import { quoteRef } from "@/lib/quotation-ui";
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
  const status = oneOf(one(sp.status), ["requested", "responded"] as const);
  const q = one(sp.q)?.slice(0, 80);
  const sort = oneOf(one(sp.sort), ["latest", "oldest"] as const) ?? "latest";
  const page = pageOf(sp);
  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listQuotations(actor, { status, q, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const { counts } = result;
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/quotations", { status, q, sort: sort === "latest" ? undefined : sort, ...over });
  return (
    <>
      <ModuleHeader href="/app/quotations" />
      <ListFilters
        action="/app/quotations"
        param="status"
        q={q}
        value={status ?? ""}
        sort={sort}
        placeholder="Reference, name, phone or words in the request"
        options={[
          { value: "", label: `All requests (${counts.all})` },
          { value: "requested", label: `New (${counts.requested})` },
          { value: "responded", label: `Responded (${counts.responded})` },
        ]}
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
                  <TH className="w-16">No.</TH>
                  <TH>Request</TH>
                  <TH>Customer</TH>
                  <TH className="w-44">Status</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((r, i) => {
                  const what = (
                    r.payload as { furnitureType?: string | null } | null
                  )?.furnitureType;
                  return (
                    <TR key={r.id}>
                      <TD className="tabular text-center text-text-muted">{(page - 1) * PAGE_SIZE + i + 1}</TD>
                      <TD>
                        <Link
                          href={`/app/messages/${r.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {quoteRef(r.reference)}
                        </Link>
                        <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">
                          {what ?? r.message ?? "—"}
                        </div>
                      </TD>
                      <TD>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-text-muted">{plainPhone(r.phone)}</div>
                      </TD>
                      <TD className="w-44 min-w-[11rem] whitespace-nowrap text-center">
                        <div className="relative flex flex-col items-center">
                          <EnquiryTag state={r.isHandled ? "responded" : "new"} />
                          <time dateTime={r.createdAt.toISOString()} className="absolute left-1/2 top-full mt-1 -translate-x-1/2 text-[0.65rem] leading-none whitespace-nowrap text-text-muted">{formatDateTime(r.createdAt, business.timezone)}</time>
                        </div>
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
