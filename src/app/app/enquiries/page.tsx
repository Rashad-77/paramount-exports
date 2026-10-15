import { EnquiryTag } from "@/components/app/tags";
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
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listEnquiries } from "@/server/messages";

export const metadata = { title: "Enquiries" };
const PAGE_SIZE = 20;
const STATES = ["new", "in_progress", "responded"] as const;

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const state = oneOf(one(sp.state), STATES);
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listEnquiries(actor, { state, q, page, pageSize: PAGE_SIZE }),
  ]);
  const { counts } = result;
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/enquiries", { state, q, ...over });
  const tab = (
    key: (typeof STATES)[number] | undefined,
    label: string,
    n: number,
  ) => ({
    label,
    count: n,
    active: state === key,
    href: buildHref("/app/enquiries", { state: key, q }),
  });

  return (
    <>
      <ModuleHeader href="/app/enquiries" />
      <FilterTabs
        label="Enquiry state"
        tabs={[
          tab(undefined, "All enquiries", counts.all),
          tab("new", "New", counts.new),
          tab("in_progress", "In progress", counts.in_progress),
          tab("responded", "Responded", counts.responded),
        ]}
      />
      <ListSearch
        action="/app/enquiries"
        params={{ state }}
        q={q}
        placeholder="Name, phone, email or words in the message"
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
                  <TH>Enquiry</TH>
                  <TH>From</TH>
                  <TH>Type</TH>
                  <TH>State</TH>
                  <TH>Received</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((r) => {
                  const badge = r.isHandled ? (
                    <EnquiryTag state="responded" />
                  ) : r.inProgress ? (
                    <EnquiryTag state="in_progress" />
                  ) : (
                    <EnquiryTag state="new" />
                  );
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
                          {r.message ?? "—"}
                        </div>
                      </TD>
                      <TD>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-text-muted">{r.phone}</div>
                      </TD>
                      <TD>{MESSAGE_KIND_LABEL[r.kind] ?? r.kind}</TD>
                      <TD>{badge}</TD>
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
