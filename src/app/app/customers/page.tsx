import { CustomersTable } from "@/components/app/customers-table";
import { EditProvider, EditToggle } from "@/components/app/edit-mode";
import { ListFilters } from "@/components/app/list-filters";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { plainPhone } from "@/lib/contact";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { CUSTOMER_FILTERS, CUSTOMER_SORTS, listCustomers } from "@/server/orders";
import { deleteCustomersAction } from "./actions";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 20;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const filter = oneOf(one(sp.filter), CUSTOMER_FILTERS);
  const sort = oneOf(one(sp.sort), CUSTOMER_SORTS) ?? "name";
  const page = pageOf(sp);
  const result = await listCustomers(actor, { q, filter, sort, page, pageSize: PAGE_SIZE });
  const { counts } = result;
  const canDelete = can(actor, "customers:delete");

  return (
    <EditProvider>
      <ModuleHeader href="/app/customers" actions={canDelete && result.rows.length > 0 ? <EditToggle /> : null} />
      <ListFilters
        action="/app/customers"
        param="filter"
        q={q}
        value={filter ?? ""}
        sort={sort}
        placeholder="Name, phone, email or customer ID"
        options={[
          { value: "", label: `All customers (${counts.all})` },
          { value: "account", label: `With an account (${counts.account})` },
          { value: "guest", label: `Without an account (${counts.guest})` },
        ]}
        sortOptions={[
          { value: "name", label: "Name A to Z" },
          { value: "name_desc", label: "Name Z to A" },
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ]}
      />
      <div className="app-results">
        {result.rows.length === 0 ? (
          <EmptyState
            title={q || filter ? "No customers match" : "No customers yet"}
            description={q || filter ? "Try a different filter or search." : "Customers appear here once they order, ask for a quotation or write to you."}
          />
        ) : (
          <CustomersTable
            rows={result.rows.map((c) => ({
              key: c.phoneKey,
              name: c.name,
              phone: plainPhone(c.phone),
              email: c.email,
              hasAccount: c.hasAccount,
              orders: c.orderRefs.length,
              messages: c.quotationRefs.length + c.enquiryRefs.length,
            }))}
            startAt={(page - 1) * PAGE_SIZE}
            total={result.total}
            canDelete={canDelete}
            deleteAction={deleteCustomersAction}
          />
        )}
        <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/customers", { q, filter, sort: sort === "name" ? undefined : sort, page: String(n) })} />
      </div>
    </EditProvider>
  );
}
