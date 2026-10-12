import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { scopeOf, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { buildHref, one, oneOf, pageOf, type SP } from "@/lib/list-params";
import { DELIVERY_TONE, windowLabel } from "@/lib/ops-ui";
import { DELIVERY_STATUSES, DELIVERY_STATUS_LABEL } from "@/lib/schemas/operations";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { listDeliveries } from "@/server/deliveries";

export const metadata = { title: "Deliveries" };

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "deliveries:view");
  const own = scopeOf(actor, "deliveries:view") === "own";
  const sp = await searchParams;
  const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const status = oneOf(one(sp.status), DELIVERY_STATUSES);
  const from = iso(one(sp.from));
  const to = iso(one(sp.to));
  const q = one(sp.q)?.slice(0, 80);
  const mine = !own && one(sp.mine) === "1";
  const page = pageOf(sp);
  const [business, result] = await Promise.all([getBusinessSettings(), listDeliveries(actor, { status, from, to, q, mine, page, pageSize: 25 })]);
  const filtered = Boolean(status || from || to || q || mine);
  return (
    <>
      <ModuleHeader href="/app/deliveries" title={own ? "My Deliveries" : undefined} description={own ? "Deliveries assigned to you." : undefined} />
      <form method="get" className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <TextField label="Search" name="q" type="search" showOptional={false} defaultValue={q} placeholder="Reference, order, contact, address" className="lg:col-span-2" />
        <SelectField label="Status" name="status" showOptional={false} defaultValue={status ?? ""} placeholder="All" options={DELIVERY_STATUSES.map((s) => ({ value: s, label: DELIVERY_STATUS_LABEL[s] }))} />
        <TextField label="From" name="from" type="date" showOptional={false} defaultValue={from} />
        <TextField label="To" name="to" type="date" showOptional={false} defaultValue={to} />
        {!own ? <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5 accent-[var(--color-walnut)]" /> Assigned to me</label> : null}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Apply</Button>
          {filtered ? <ButtonLink href="/app/deliveries" variant="ghost">Clear</ButtonLink> : null}
        </div>
      </form>
      <p className="mb-3 text-sm text-text-muted" role="status">{result.total} {result.total === 1 ? "delivery" : "deliveries"}</p>
      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? "No deliveries match" : "No deliveries yet"} description={filtered ? "Try clearing a filter." : "Open a confirmed order and choose “Schedule delivery”."} />
      ) : (
        <TableWrap label="Deliveries">
          <Table>
            <THead>
              <tr><TH>Delivery</TH><TH>When</TH><TH>Status</TH><TH className="hidden md:table-cell">Contact and address</TH><TH className="hidden lg:table-cell">Delivered by</TH></tr>
            </THead>
            <tbody>
              {result.rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link className="font-medium text-walnut underline" href={`/app/deliveries/${r.id}`}>{r.reference}</Link><span className="block text-xs text-text-muted">{r.orderReference}</span></TD>
                  <TD className="whitespace-nowrap">{formatDate(r.scheduledOn, business.timezone)}<span className="block text-xs text-text-muted">{windowLabel(r.windowStart, r.windowEnd)}</span></TD>
                  <TD><StatusBadge tone={DELIVERY_TONE[r.status]}>{DELIVERY_STATUS_LABEL[r.status]}</StatusBadge></TD>
                  <TD className="hidden max-w-xs md:table-cell"><span className="font-medium">{r.contactName}</span><span className="line-clamp-1 block text-xs text-text-muted">{r.addressLine}</span></TD>
                  <TD className="hidden lg:table-cell">{r.assigneeName ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Pagination page={page} pageCount={result.pageCount} hrefFor={(n) => buildHref("/app/deliveries", { q, status, from, to, mine: mine ? "1" : undefined, page: String(n) })} />
    </>
  );
}
