import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { Pagination, Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { buildHref, one, pageOf, type SP } from "@/lib/list-params";
import { ITEM_KIND_LABEL, MANUAL_KINDS, MANUAL_KIND_LABEL } from "@/lib/schemas/inventory";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getItemWithLedger, listLocations } from "@/server/inventory";
import { manualMovementAction, thresholdAction, updateItemAction } from "../actions";

export const metadata = { title: "Stock item" };

const MOVE_LABEL: Record<string, string> = {
  opening: "Opening balance",
  receipt: "Received",
  sale: "Sold / delivered",
  reserve: "Reserved",
  release: "Reservation released",
  transfer_out: "Transferred out",
  transfer_in: "Transferred in",
  production_consume: "Used in production",
  production_output: "Produced",
  waste: "Written off",
  adjustment: "Correction",
};
const n3 = (v: string) => String(Number(v));
const signed = (v: string) => (Number(v) > 0 ? `+${n3(v)}` : n3(v));

export default async function StockItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const page = pageOf(await searchParams);
  void one;
  const actor = await requireActor();
  let d;
  try {
    d = await getItemWithLedger(actor, id, page);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [business, locs] = await Promise.all([getBusinessSettings(), listLocations(actor)]);
  const canAdjust = can(actor, "inventory:adjust");
  const { item } = d;
  const refLink = (m: { refType: string | null; refId: string | null }) =>
    m.refType === "sales_order" && m.refId && can(actor, "orders:view") ? <Link className="underline" href={`/app/orders/${m.refId}`}>order</Link> : null;

  return (
    <>
      <PageHeader title={item.name} description={`${item.sku} · ${ITEM_KIND_LABEL[item.kind]} · counted in ${item.unit}`} actions={d.product && can(actor, "products:view") ? <Link className="inline-flex min-h-10 items-center underline" href={`/app/products/${d.product.productId}`}>View product</Link> : undefined} />
      {!item.isActive ? <StatusBadge tone="warning">Inactive</StatusBadge> : null}

      <div className="mt-4 grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="Levels by location">
            {d.balances.length === 0 ? (
              <p className="text-sm text-text-muted">No stock recorded yet. Add an opening balance.</p>
            ) : (
              <TableWrap label="Levels by location">
                <Table>
                  <THead>
                    <tr>
                      <TH>Location</TH>
                      <TH className="text-right">On hand</TH>
                      <TH className="text-right">Reserved</TH>
                      <TH className="text-right">Available</TH>
                      <TH className="text-right">Low-stock level</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {d.balances.map((b) => {
                      const low = b.threshold !== null && Number(b.available) <= Number(b.threshold);
                      return (
                        <TR key={b.locationId}>
                          <TD className="font-medium">{b.locationName}</TD>
                          <TD numeric>{n3(b.onHand)}</TD>
                          <TD numeric>{n3(b.reserved)}</TD>
                          <TD numeric>
                            {n3(b.available)} {low ? <StatusBadge tone="warning" className="ml-1">Low</StatusBadge> : null}
                          </TD>
                          <TD numeric>{b.threshold === null ? "—" : n3(b.threshold)}</TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Panel>

          <Panel title="Stock ledger" description="Every change, newest first. Entries are never edited or deleted; mistakes are fixed with a new correction.">
            {d.movements.length === 0 ? (
              <p className="text-sm text-text-muted">Nothing recorded yet.</p>
            ) : (
              <TableWrap label="Stock ledger">
                <Table>
                  <THead>
                    <tr>
                      <TH>When</TH>
                      <TH>What</TH>
                      <TH>Location</TH>
                      <TH className="text-right">On hand</TH>
                      <TH className="text-right">Reserved</TH>
                      <TH className="hidden md:table-cell">Reason / by</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {d.movements.map((m) => (
                      <TR key={m.id}>
                        <TD className="whitespace-nowrap">{formatDateTime(m.createdAt, business.timezone)}</TD>
                        <TD>
                          {MOVE_LABEL[m.type] ?? m.type} {refLink(m)}
                        </TD>
                        <TD>{m.locationName}</TD>
                        <TD numeric>{Number(m.onHandDelta) === 0 ? "—" : signed(m.onHandDelta)}</TD>
                        <TD numeric>{Number(m.reservedDelta) === 0 ? "—" : signed(m.reservedDelta)}</TD>
                        <TD className="hidden md:table-cell">
                          {m.reason ?? "—"}
                          <div className="text-xs text-text-muted">{m.byName ?? "System"}</div>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
            <Pagination page={page} pageCount={d.pageCount} hrefFor={(n) => buildHref(`/app/stock/${id}`, { page: String(n) })} />
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          {canAdjust ? (
            <>
              <Panel title="Record a stock change" description="Needs a reason. Recorded with your name and the time.">
                <ActionForm action={manualMovementAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <FSelect name="locationId" label="Location" required placeholder="Choose a location" options={locs.map((l) => ({ value: l.id, label: l.name }))} />
                  <FSelect name="kind" label="Type of change" required defaultValue="receipt" options={MANUAL_KINDS.map((k) => ({ value: k, label: MANUAL_KIND_LABEL[k] }))} />
                  <FField name="quantity" label={`Quantity (${item.unit})`} required inputMode="decimal" />
                  <FTextArea name="reason" label="Reason" required rows={2} hint="e.g. Delivery note 1234, stock take, damaged in handling." />
                  <SubmitButton>Record change</SubmitButton>
                </ActionForm>
              </Panel>
              <Panel title="Low-stock level" description="Shows a warning when available stock falls to this level. Leave blank to remove.">
                <ActionForm action={thresholdAction}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <FSelect name="locationId" label="Location" required placeholder="Choose a location" options={locs.map((l) => ({ value: l.id, label: l.name }))} />
                  <FField name="threshold" label={`Alert at or below (${item.unit})`} inputMode="decimal" />
                  <SubmitButton variant="secondary">Save level</SubmitButton>
                </ActionForm>
              </Panel>
              <Panel title="Details">
                <ActionForm action={updateItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <FField name="name" label="Name" required defaultValue={item.name} />
                  <FField name="unit" label="Unit" required defaultValue={item.unit} />
                  <FField name="costPrice" label="Cost per unit" inputMode="decimal" defaultValue={item.costPrice ?? ""} />
                  <FCheckbox name="isActive" label="Active" defaultChecked={item.isActive} />
                  <SubmitButton variant="secondary">Save details</SubmitButton>
                </ActionForm>
              </Panel>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
