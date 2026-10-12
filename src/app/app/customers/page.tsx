import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, pageOf, type SP } from "@/lib/list-params";
import { listCustomers } from "@/server/customers";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const archived = one(sp.archived) === "1";
  const page = pageOf(sp);
  const result = await listCustomers(actor, { q, archived, page, pageSize: 25 });
  return (
    <>
      <ModuleHeader href="/app/customers" actions={can(actor, "customers:write") ? <ButtonLink href="/app/customers/new">Add customer</ButtonLink> : undefined} />
      <form method="get" className="mb-6 flex flex-col gap-3 border border-border bg-surface p-4 sm:flex-row sm:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Name, company, phone or email" className="flex-1" />
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} className="size-5 accent-[var(--color-walnut)]" /> Show archived
        </label>
        <Button type="submit">Search</Button>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "customer" : "customers"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={q ? "No customers match" : "No customers yet"} description={q ? "Check the spelling or try a phone number." : "Add a customer, or create one from an enquiry."} />
      ) : (
        <TableWrap label="Customers">
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Phone</TH>
                <TH className="hidden md:table-cell">Email</TH>
                <TH className="hidden sm:table-cell">Enquiries</TH>
                <TH className="hidden sm:table-cell">Quotations</TH>
              </tr>
            </THead>
            <tbody>
              {result.rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/app/customers/${c.id}`} className="font-medium text-walnut underline">{c.name}</Link>
                    {c.company ? <div className="text-text-muted">{c.company}</div> : null}
                  </TD>
                  <TD className="tabular">{c.phone}</TD>
                  <TD className="hidden md:table-cell">{c.email ?? "—"}</TD>
                  <TD numeric className="hidden sm:table-cell">{c.leadCount}</TD>
                  <TD numeric className="hidden sm:table-cell">{c.quotationCount}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/customers", { q, archived: archived ? "1" : undefined, page: String(n) })} />
    </>
  );
}
