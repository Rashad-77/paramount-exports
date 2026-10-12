import { notFound, redirect } from "next/navigation";
import { PoForm } from "@/components/app/po-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { getBusinessSettings } from "@/lib/settings";
import { listLocations } from "@/server/inventory";
import { getPurchaseOrder, listStockItemOptions, listSuppliers } from "@/server/purchasing";
import { updatePoAction } from "../../actions";

export const metadata = { title: "Edit purchase order" };

export default async function EditPoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  requirePermission(actor, "purchasing:write");
  let po;
  try {
    po = await getPurchaseOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (po.status !== "draft") redirect(`/app/purchase-orders/${id}`);
  const [business, suppliers, locs, items] = await Promise.all([getBusinessSettings(), listSuppliers(actor), listLocations(actor), listStockItemOptions(actor)]);
  return (
    <>
      <PageHeader title={`Edit ${po.reference}`} description="Only drafts can be edited." />
      <Panel>
        <PoForm
          action={updatePoAction}
          hidden={{ id }}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          locations={locs.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name }))}
          items={items}
          currency={business.currency}
          showCosts={can(actor, "production:view_costs")}
          initial={{ supplierId: po.supplierId, locationId: po.locationId, expectedOn: po.expectedOn ?? "", notes: po.notes ?? "", lines: po.lines.map((l) => ({ itemId: l.itemId, quantity: String(Number(l.quantityOrdered)), expectedUnitCost: l.expectedUnitCost ?? "" })) }}
          submitLabel="Save changes"
        />
      </Panel>
    </>
  );
}
