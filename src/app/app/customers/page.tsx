import Link from "next/link";
import { ListSearch } from "@/components/app/list-search";
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
import { buildHref, one, pageOf, type SP } from "@/lib/list-params";
import { formatMoney } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listCustomers } from "@/server/orders";

export const metadata = { title: "Customers" };
const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const page = pageOf(sp);
  const [business, result] = await Promise.all([
    getBusinessSettings(),
    listCustomers(actor, { q, page, pageSize: PAGE_SIZE }),
  ]);

  return (
    <>
      <ModuleHeader href="/app/customers" />
      <ListSearch
        action="/app/customers"
        params={{}}
        q={q}
        placeholder="Name, phone or email"
      />
      <div className="app-results">
        <p className="mb-3 text-sm text-text-muted" role="status">
          {result.total} {result.total === 1 ? "customer" : "customers"}
        </p>
        {result.rows.length === 0 ? (
          <EmptyState
            title={q ? "No customers match" : "No customers yet"}
            description={
              q
                ? "Try a different search."
                : "Customers appear here once they order, ask for a quotation or write to you."
            }
          />
        ) : (
          <TableWrap label="Customers">
            <Table>
              <THead>
                <tr>
                  <TH>Customer</TH>
                  <TH className="hidden md:table-cell">Email</TH>
                  <TH className="text-right">Orders</TH>
                  <TH className="text-right hidden lg:table-cell">
                    Quotations
                  </TH>
                  <TH className="text-right hidden lg:table-cell">Enquiries</TH>
                  <TH className="text-right hidden sm:table-cell">
                    Ordered in total
                  </TH>
                  <TH className="hidden lg:table-cell">Last contact</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((c) => (
                  <TR key={c.phoneKey}>
                    <TD>
                      <Link
                        href={`/app/customers/${c.phoneKey}`}
                        className="font-medium text-walnut underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-text-muted">{c.phone}</div>
                      {c.hasAccount ? (
                        <div className="text-xs font-medium text-text-muted">
                          Has a website account
                        </div>
                      ) : null}
                    </TD>
                    <TD className="hidden md:table-cell">{c.email ?? "—"}</TD>
                    <TD numeric>{c.orders}</TD>
                    <TD numeric className="hidden lg:table-cell">
                      {c.quotations}
                    </TD>
                    <TD numeric className="hidden lg:table-cell">
                      {c.enquiries}
                    </TD>
                    <TD numeric className="hidden sm:table-cell">
                      {formatMoney(c.spent, c.currency)}
                    </TD>
                    <TD className="hidden whitespace-nowrap lg:table-cell">
                      {formatDate(c.lastContactAt, business.timezone)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination
          page={page}
          pageCount={result.pageCount}
          hrefFor={(n) => buildHref("/app/customers", { q, page: String(n) })}
        />
      </div>
    </>
  );
}
