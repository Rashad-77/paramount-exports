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
import { quoteRef } from "@/lib/quotation-ui";
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
  const result = await listCustomers(actor, { q, page, pageSize: PAGE_SIZE });

  return (
    <>
      <ModuleHeader href="/app/customers" />
      <ListSearch
        action="/app/customers"
        params={{}}
        q={q}
        placeholder="Name, phone, email or account ID"
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
                  <TH className="w-14">No.</TH>
                  <TH className="min-w-64 border-r border-border-strong/50 last:border-r-0">Customer</TH>
                  <TH className="min-w-44 border-r border-border-strong/50 last:border-r-0">Orders</TH>
                  <TH className="min-w-44 border-r border-border-strong/50 last:border-r-0">Quotations</TH>
                  <TH className="min-w-44 border-r border-border-strong/50 last:border-r-0">Enquiries</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((c, index) => (
                  <TR key={c.phoneKey} className="hover:bg-paper-deep/70">
                    <TD className="w-14 align-middle py-3 text-text-muted">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </TD>
                    <TD className="min-w-64 border-r border-border-strong/50 py-3 last:border-r-0">
                      <Link
                        href={`/app/customers/${c.phoneKey}`}
                        className="font-medium text-walnut underline"
                      >
                        {c.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-text-muted">CUS-{c.phoneKey}</div>
                      <div className="mt-1 flex flex-col items-start gap-0.5 text-xs text-text-muted">
                        <a className="hover:text-text" href={`tel:${c.phone.replace(/\s+/g, "")}`}>
                          {c.phone}
                        </a>
                        {c.email ? (
                          <a className="max-w-full truncate hover:text-text" href={`mailto:${c.email}`} title={c.email}>
                            {c.email}
                          </a>
                        ) : null}
                      </div>
                    </TD>
                    <TD className="min-w-44 align-top border-r border-border-strong/50 py-3 last:border-r-0">
                      <div className="flex flex-col items-start gap-1">
                        {c.orderRefs.length ? c.orderRefs.map((r) => (
                          <Link key={r.id} href={`/app/orders/${r.id}`} className="inline-flex w-fit border border-border px-1.5 py-0.5 text-[12.2px] leading-4 text-walnut underline hover:text-brand-dark" title={`Open order ${r.reference}`}>
                            {r.reference}
                          </Link>
                        )) : <span className="px-3 text-text-muted">—</span>}
                      </div>
                    </TD>
                    <TD className="min-w-44 align-top border-r border-border-strong/50 py-3 last:border-r-0">
                      <div className="flex flex-col items-start gap-1">
                        {c.quotationRefs.length ? c.quotationRefs.map((r) => (
                          <Link key={r.id} href={`/app/messages/${r.id}`} className="inline-flex w-fit border border-border px-1.5 py-0.5 text-[12.2px] leading-4 text-walnut underline hover:text-brand-dark" title={`Open quotation ${quoteRef(r.reference)}`}>
                            {quoteRef(r.reference)}
                          </Link>
                        )) : <span className="px-3 text-text-muted">—</span>}
                      </div>
                    </TD>
                    <TD className="min-w-44 align-top border-r border-border-strong/50 py-3 last:border-r-0">
                      <div className="flex flex-col items-start gap-1">
                        {c.enquiryRefs.length ? c.enquiryRefs.map((r) => (
                          <Link key={r.id} href={`/app/messages/${r.id}`} className="inline-flex w-fit border border-border px-1.5 py-0.5 text-[12.2px] leading-4 text-walnut underline hover:text-brand-dark" title={`Open enquiry ${r.reference}`}>
                            {r.reference}
                          </Link>
                        )) : <span className="px-3 text-text-muted">—</span>}
                      </div>
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
