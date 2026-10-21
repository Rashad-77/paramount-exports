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
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listEnquiries } from "@/server/messages";

export const metadata = { title: "Enquiries" };
const PAGE_SIZE = 20;
const STATES = ["new", "responded"] as const;

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const state = oneOf(one(sp.state), STATES);
  const q = one(sp.q)?.slice(0, 80);
  const sort = oneOf(one(sp.sort), ["latest", "oldest"] as const) ?? "latest";
  const page = pageOf(sp);
  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listEnquiries(actor, { state, q, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const { counts } = result;
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/enquiries", { state, q, sort: sort === "latest" ? undefined : sort, ...over });
  return (
    <>
      <ModuleHeader href="/app/enquiries" />
      <ListFilters
        action="/app/enquiries"
        param="state"
        q={q}
        value={state ?? ""}
        sort={sort}
        placeholder="Name, phone, email or words in the message"
        options={[
          { value: "", label: `All enquiries (${counts.all})` },
          { value: "new", label: `New (${counts.new})` },
          { value: "responded", label: `Responded (${counts.responded})` },
        ]}
      />
      <div className="app-results">
        {result.rows.length === 0 ? (
          <EmptyState
            title={q || state ? "No enquiries match" : "No enquiries yet"}
            description={
              q || state
                ? "Try a different tab or search."
                : "Messages from the contact form and product pages will appear here."
            }
          />
        ) : (
          <TableWrap label="Enquiries">
            <Table>
              <THead>
                <tr>
                  <TH className="w-16">No.</TH>
                  <TH>Enquiry</TH>
                  <TH className="w-52">Customer</TH>
                  <TH className="w-44">Status</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((r, i) => {
                  const badge = r.isHandled ? (
                    <EnquiryTag state="responded" />
                  ) : (
                    <EnquiryTag state="new" />
                  );
                  return (
                    <TR key={r.id}>
                      <TD className="tabular text-center text-text-muted">{(page - 1) * PAGE_SIZE + i + 1}</TD>
                      <TD>
                        <Link
                          href={`/app/messages/${r.id}`}
                          className="font-medium text-walnut underline"
                        >
                          {r.reference}
                        </Link>
                        <div className="mt-0.5 line-clamp-1 max-w-md text-text-muted">
                          {r.message ?? "—"}
                        </div>
                      </TD>
                      <TD className="text-center">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-text-muted">{plainPhone(r.phone)}</div>
                      </TD>
                      <TD className="w-44 min-w-[11rem] whitespace-nowrap text-center">
                        <div className="relative flex flex-col items-center">
                          {badge}
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
