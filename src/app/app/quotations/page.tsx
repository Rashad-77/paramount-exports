import { EditProvider, EditToggle } from "@/components/app/edit-mode";
import { ListFilters } from "@/components/app/list-filters";
import { QuotationsTable } from "@/components/app/quotations-table";
import { ModuleHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { plainPhone } from "@/lib/contact";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { quoteRef } from "@/lib/quotation-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listQuotations } from "@/server/messages";
import { deleteQuotationsAction } from "./actions";

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
  const canDelete = can(actor, "customers:delete");
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/quotations", {
      status,
      q,
      sort: sort === "latest" ? undefined : sort,
      ...over,
    });
  const rows = result.rows.map((r) => ({
    id: r.id,
    reference: quoteRef(r.reference),
    summary: (r.payload as { furnitureType?: string | null } | null)?.furnitureType ?? r.message ?? "—",
    name: r.name,
    phone: plainPhone(r.phone),
    handled: r.isHandled,
    createdIso: r.createdAt.toISOString(),
    createdText: formatDateTime(r.createdAt, business.timezone),
  }));
  return (
    <EditProvider>
      <ModuleHeader href="/app/quotations" actions={canDelete && rows.length > 0 ? <EditToggle /> : null} />
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
        <QuotationsTable
          rows={rows}
          startAt={(page - 1) * PAGE_SIZE}
          total={counts.all}
          canDelete={canDelete}
          deleteAction={deleteQuotationsAction}
          empty={{
            title: q || status ? "No quotations match" : "No quotation requests yet",
            description: q || status ? "Try a different tab or search." : "Made-to-measure requests from the website will appear here.",
          }}
        />
        <Pagination
          page={page}
          pageCount={result.pageCount}
          hrefFor={(n) => href({ page: String(n) })}
        />
      </div>
    </EditProvider>
  );
}
