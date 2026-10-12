import { notFound, redirect } from "next/navigation";
import type { EditorItem } from "@/components/app/quotation-editor";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { listVariantOptions } from "@/server/catalogue";
import { listLocations } from "@/server/inventory";
import { getOrder } from "@/server/orders";
import { updateOrderAction } from "../../actions";

export const metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  requirePermission(actor, "orders:write");
  let d;
  try {
    d = await getOrder(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (d.order.status !== "draft" || d.order.type !== "ready_made") redirect(`/app/orders/${id}`);
  const [variants, locs] = await Promise.all([listVariantOptions(actor), listLocations(actor)]);
  const items: EditorItem[] = d.items.map((i) => ({ kind: "ready_made", variantId: i.variantId ?? "", description: i.description, dimensions: "", material: "", finish: "", notes: "", quantity: String(Number(i.quantity)), unitPrice: i.unitPrice, discountAmount: i.discountAmount }));
  return (
    <>
      <PageHeader title={`Edit ${d.order.reference}`} description={`Draft for ${d.customer.name}`} />
      <Panel>
        <OrderForm action={updateOrderAction} hidden={{ id }} variants={variants} locations={locs.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name }))} currency={d.order.currency} submitLabel="Save draft" initial={{ locationId: d.order.locationId ?? "", deliveryCharge: d.order.deliveryCharge, depositTerms: d.order.depositTerms ?? "", notes: d.order.notes ?? "", items }} />
      </Panel>
    </>
  );
}
