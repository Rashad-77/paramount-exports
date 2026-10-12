import { notFound } from "next/navigation";
import { DeliveryForm } from "@/components/app/delivery-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { addDaysLocal } from "@/lib/time";
import { deliveryDefaults, listDeliveryStaff } from "@/server/deliveries";
import { createDeliveryAction } from "../actions";

export const metadata = { title: "Schedule delivery" };

export default async function NewDeliveryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "deliveries:write");
  const orderId = one((await searchParams).orderId);
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  let d;
  try {
    d = await deliveryDefaults(actor, orderId);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [business, staff] = await Promise.all([getBusinessSettings(), listDeliveryStaff(actor)]);
  const schedulable = ["confirmed", "preparing", "ready"].includes(d.orderStatus);
  return (
    <>
      <PageHeader title="Schedule delivery" description={`For order ${d.orderReference}. The customer's details are filled in; change them if the delivery goes elsewhere.`} />
      {!schedulable ? <Alert tone="warning" title="This order cannot be scheduled" className="mb-6">Only confirmed orders that have not been delivered or cancelled can be scheduled.</Alert> : null}
      <Panel>
        <DeliveryForm
          action={createDeliveryAction}
          hidden={{ orderId }}
          staff={staff}
          currency={business.currency}
          submitLabel="Schedule delivery"
          initial={{ scheduledOn: addDaysLocal(1, business.timezone), windowStart: "", windowEnd: "", addressLine: d.addressLine, contactName: d.contactName, contactPhone: d.contactPhone, fee: d.fee, assigneeId: "", notes: "" }}
        />
      </Panel>
    </>
  );
}
