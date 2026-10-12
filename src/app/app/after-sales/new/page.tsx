import { notFound } from "next/navigation";
import { CustomerPicker } from "@/components/app/customer-picker";
import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { CASE_TYPES, CASE_TYPE_LABEL } from "@/lib/schemas/operations";
import { getCustomer } from "@/server/customers";
import { listDeliveryStaff } from "@/server/deliveries";
import { listOrders } from "@/server/orders";
import { createCaseAction } from "../actions";

export const metadata = { title: "New after-sales case" };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "aftersales:manage");
  const sp = await searchParams;
  const customerId = one(sp.customerId);
  if (!customerId) {
    return (
      <>
        <PageHeader title="New after-sales case" description="Choose the customer first." />
        <Panel><CustomerPicker actor={actor} basePath="/app/after-sales/new" q={one(sp.q)?.slice(0, 80)} /></Panel>
      </>
    );
  }
  let customer;
  try {
    customer = (await getCustomer(actor, customerId)).customer;
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const orderId = one(sp.orderId);
  const [orders, staff] = await Promise.all([listOrders(actor, { customerId, page: 1, pageSize: 50 }).then((r) => r.rows.filter((o) => o.status !== "draft" && o.status !== "cancelled")), listDeliveryStaff(actor).catch(() => [])]);
  return (
    <>
      <PageHeader title="New after-sales case" description={`For ${customer.name}.`} />
      <Panel>
        <ActionForm action={createCaseAction}>
          <input type="hidden" name="customerId" value={customerId} />
          <div className="grid gap-5 md:grid-cols-2">
            <FSelect name="type" label="Type" required defaultValue="warranty" options={CASE_TYPES.map((t) => ({ value: t, label: CASE_TYPE_LABEL[t] }))} />
            <FSelect name="orderId" label="Related order" defaultValue={orderId ?? ""} placeholder="Not linked to an order" options={orders.map((o) => ({ value: o.id, label: o.reference }))} />
            <FField name="subject" label="Subject" required hint="e.g. Loose chair leg" />
            <FField name="dueOn" label="Resolve by" type="date" />
            <FSelect name="assigneeId" label="Assigned to" placeholder="Not assigned" options={staff.map((s) => ({ value: s.id, label: s.name }))} />
          </div>
          <FTextArea name="description" label="Details" rows={4} />
          <SubmitButton>Open case</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
