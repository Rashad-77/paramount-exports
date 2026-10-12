import { notFound, redirect } from "next/navigation";
import { QuotationForm } from "@/components/app/quotation-form";
import type { EditorItem } from "@/components/app/quotation-editor";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { listVariantOptions } from "@/server/catalogue";
import { getQuotation } from "@/server/quotations";
import { updateQuotationAction } from "../../actions";

export const metadata = { title: "Edit quotation" };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  requirePermission(actor, "quotations:write");
  let data;
  try {
    data = await getQuotation(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (data.quotation.status !== "draft") redirect(`/app/quotations/${id}`);
  const variants = await listVariantOptions(actor);
  const items: EditorItem[] = data.items.map((i) => {
    const s = (i.specification ?? {}) as Record<string, string>;
    return { kind: i.kind, variantId: i.variantId ?? "", description: i.description, dimensions: s.dimensions ?? "", material: s.material ?? "", finish: s.finish ?? "", notes: s.notes ?? "", quantity: String(Number(i.quantity)), unitPrice: i.unitPrice, discountAmount: i.discountAmount };
  });
  return (
    <>
      <PageHeader title={`Edit ${data.quotation.reference}`} description={`Revision ${data.revision.revisionNo} · ${data.customer.name}`} />
      <Panel>
        <QuotationForm
          action={updateQuotationAction}
          hidden={{ id }}
          variants={variants}
          currency={data.quotation.currency}
          submitLabel="Save draft"
          initial={{ validUntil: data.revision.validUntil, deliveryCharge: data.revision.deliveryCharge, terms: data.revision.terms ?? "", customerNotes: data.revision.customerNotes ?? "", internalNotes: data.revision.internalNotes ?? "", items }}
        />
      </Panel>
    </>
  );
}
