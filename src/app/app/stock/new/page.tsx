import { ActionForm, FField, FSelect, SubmitButton } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { ITEM_KINDS, ITEM_KIND_LABEL } from "@/lib/schemas/inventory";
import { createItemAction } from "../actions";

export const metadata = { title: "Add stock item" };

export default async function NewStockItemPage() {
  const actor = await requireActor();
  requirePermission(actor, "inventory:adjust");
  void can;
  return (
    <>
      <PageHeader title="Add stock item" description="For materials (timber, boards, hardware, finishes) and any finished goods that are not a catalogue product. Catalogue products get a stock item by turning on stock tracking on the product page." />
      <Panel>
        <ActionForm action={createItemAction}>
          <div className="grid gap-5 md:grid-cols-2">
            <FSelect name="kind" label="Type" required defaultValue="raw_material" options={ITEM_KINDS.map((k) => ({ value: k, label: ITEM_KIND_LABEL[k]! }))} />
            <FField name="sku" label="SKU / code" required hint="Unique." />
            <FField name="name" label="Name" required placeholder="e.g. Teak plank 50×150" />
            <FField name="unit" label="Unit" required defaultValue="pcs" hint="e.g. pcs, m, m³, sheet, kg, litre." />
            <FField name="costPrice" label="Cost per unit" inputMode="decimal" hint="Optional. Used for estimated job costs only." />
          </div>
          <SubmitButton>Create stock item</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
