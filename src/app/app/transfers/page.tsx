import { TransferForm } from "@/components/app/transfer-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { buildHref, pageOf, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { listLocations, listStock, listTransfers } from "@/server/inventory";
import { transferAction } from "../stock/actions";

export const metadata = { title: "Stock transfers" };

export default async function TransfersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  const page = pageOf(await searchParams);
  const [business, locs, history, stock] = await Promise.all([getBusinessSettings(), listLocations(actor), listTransfers(actor, page), listStock(actor, { page: 1, pageSize: 500 })]);
  return (
    <>
      <PageHeader title="Stock transfers" description="Move stock between the showroom and the workshop. Both sides are recorded together, or not at all." />
      <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 order-2 xl:order-1">
          {history.rows.length === 0 ? (
            <EmptyState title="No transfers yet" description="Record one using the form." />
          ) : (
            <TableWrap label="Transfers">
              <Table>
                <THead>
                  <tr>
                    <TH>Reference</TH>
                    <TH>Route</TH>
                    <TH>Items</TH>
                    <TH className="hidden md:table-cell">When / by</TH>
                  </tr>
                </THead>
                <tbody>
                  {history.rows.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium">{r.reference}</TD>
                      <TD>{r.fromName} → {r.toName}</TD>
                      <TD>{r.lines}{r.note ? <div className="text-text-muted">{r.note}</div> : null}</TD>
                      <TD className="hidden md:table-cell">{formatDateTime(r.createdAt, business.timezone)}<div className="text-xs text-text-muted">{r.byName}</div></TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <Pagination page={page} pageCount={history.pageCount} hrefFor={(n) => buildHref("/app/transfers", { page: String(n) })} />
        </div>
        <div className="min-w-0 order-1 xl:order-2">
          <Panel title="New transfer">
            <TransferForm action={transferAction} locations={locs.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name }))} items={stock.rows.map((r) => ({ id: r.id, label: `${r.name} (${r.sku})` }))} />
          </Panel>
        </div>
      </div>
    </>
  );
}
