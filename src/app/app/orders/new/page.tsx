import { notFound } from "next/navigation";
import { CustomerPicker } from "@/components/app/customer-picker";
import { OrderForm } from "@/components/app/order-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { listVariantOptions } from "@/server/catalogue";
import { getCustomer } from "@/server/customers";
import { listLocations } from "@/server/inventory";
import { createOrderAction } from "../actions";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "orders:write");
  const sp = await searchParams;
  const customerId = one(sp.customerId);
  if (!customerId) {
    return (
      <>
        <PageHeader title="New ready-made order" description="Choose the customer first." />
        <Panel>
          <CustomerPicker actor={actor} basePath="/app/orders/new" q={one(sp.q)?.slice(0, 80)} />
        </Panel>
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
  const [business, variants, locs] = await Promise.all([getBusinessSettings(), listVariantOptions(actor), listLocations(actor)]);
  const active = locs.filter((l) => l.isActive);
  return (
    <>
      <PageHeader title="New ready-made order" description={`For ${customer.name}. Stock is reserved only when you confirm.`} />
      <Panel>
        <OrderForm action={createOrderAction} hidden={{ customerId }} variants={variants} locations={active.map((l) => ({ id: l.id, name: l.name }))} currency={business.currency} submitLabel="Save draft" initial={{ locationId: active.find((l) => l.kind === "showroom")?.id ?? "", deliveryCharge: "0", depositTerms: "", notes: "", items: [] }} />
      </Panel>
    </>
  );
}
