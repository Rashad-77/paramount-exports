import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { listSuppliers } from "@/server/purchasing";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const archived = one(sp.archived) === "1";
  const rows = await listSuppliers(actor, { q, includeArchived: archived });
  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy materials from." actions={can(actor, "suppliers:write") ? <ButtonLink href="/app/suppliers/new">New supplier</ButtonLink> : undefined} />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-3 sm:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Name or materials supplied" />
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={archived} className="size-5 accent-[var(--color-walnut)]" /> Include archived</label>
        <div className="flex gap-2"><Button type="submit">Apply</Button>{q || archived ? <ButtonLink href="/app/suppliers" variant="ghost">Clear</ButtonLink> : null}</div>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={q ? "No suppliers match" : "No suppliers yet"} description={q ? "Try a different search." : "Add the people you buy timber, fittings and finishes from."} />
      ) : (
        <TableWrap label="Suppliers">
          <Table>
            <THead><tr><TH>Name</TH><TH className="hidden md:table-cell">Contact</TH><TH className="hidden md:table-cell">Phone</TH><TH className="hidden lg:table-cell">Supplies</TH><TH>Status</TH></tr></THead>
            <tbody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/suppliers/${s.id}`}>{s.name}</Link></TD>
                  <TD className="hidden md:table-cell">{s.contactName ?? "—"}</TD>
                  <TD className="hidden md:table-cell">{s.phone ?? "—"}</TD>
                  <TD className="hidden max-w-xs lg:table-cell"><span className="line-clamp-1">{s.suppliedMaterials ?? "—"}</span></TD>
                  <TD><StatusBadge tone={s.archivedAt ? "neutral" : "success"}>{s.archivedAt ? "Archived" : "Active"}</StatusBadge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
