import { DeleteSelectedButton } from "@/components/app/delete-selected";
import { EditProvider, EditToggle } from "@/components/app/edit-mode";
import { ListFilters } from "@/components/app/list-filters";
import { MessagesTable } from "@/components/app/messages-table";
import { ModuleHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { plainPhone } from "@/lib/contact";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listEnquiries } from "@/server/messages";
import { deleteEnquiriesAction } from "./actions";

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
  const canDelete = can(actor, "customers:delete");
  const href = (over: Record<string, string | undefined>) =>
    buildHref("/app/enquiries", {
      state,
      q,
      sort: sort === "latest" ? undefined : sort,
      ...over,
    });
  const rows = result.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    summary: r.message ?? "—",
    name: r.name,
    phone: plainPhone(r.phone),
    handled: r.isHandled,
    createdIso: r.createdAt.toISOString(),
    createdText: formatDateTime(r.createdAt, business.timezone),
  }));
  return (
    <EditProvider>
      <ModuleHeader
        href="/app/enquiries"
        actions={
          canDelete && rows.length > 0 ? (
            <>
              <EditToggle />
              <DeleteSelectedButton items={rows.map((r) => ({ id: r.id, label: r.reference }))} singular="enquiry" plural="enquiries" action={deleteEnquiriesAction} />
            </>
          ) : null
        }
      />
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
        <MessagesTable
          rows={rows}
          startAt={(page - 1) * PAGE_SIZE}
          canDelete={canDelete}
          label="Enquiries"
          requestHeading="Enquiry"
          empty={{
            title: q || state ? "No enquiries match" : "No enquiries yet",
            description: q || state ? "Try a different tab or search." : "Messages from the contact form and product pages will appear here.",
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
