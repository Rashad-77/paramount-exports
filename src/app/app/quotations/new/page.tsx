import { notFound } from "next/navigation";
import { QuotationForm } from "@/components/app/quotation-form";
import { CustomerPicker } from "@/components/app/customer-picker";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { one, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { addDaysLocal } from "@/lib/time";
import { getCustomer } from "@/server/customers";
import { listVariantOptions } from "@/server/catalogue";
import { createQuotationAction } from "../actions";

export const metadata = { title: "New quotation" };

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "quotations:write");
  const sp = await searchParams;
  const customerId = one(sp.customerId);
  const leadId = one(sp.leadId);
  if (!customerId) {
    return (
      <>
        <PageHeader title="New quotation" description="Choose the customer first." />
        <Panel>
          <CustomerPicker actor={actor} basePath="/app/quotations/new" q={one(sp.q)?.slice(0, 80)} />
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
  const [business, variants] = await Promise.all([getBusinessSettings(), listVariantOptions(actor)]);
  return (
    <>
      <PageHeader title="New quotation" description={`For ${customer.name}${customer.company ? ` (${customer.company})` : ""}`} />
      <Panel>
        <QuotationForm
          action={createQuotationAction}
          hidden={{ customerId, ...(leadId ? { leadId } : {}) }}
          variants={variants}
          currency={business.currency}
          submitLabel="Save draft"
          initial={{ validUntil: addDaysLocal(30, business.timezone), deliveryCharge: "0", terms: "", customerNotes: "", internalNotes: "", items: [] }}
        />
      </Panel>
    </>
  );
}
