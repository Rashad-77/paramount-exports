import { PoForm } from "@/components/app/po-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can, requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { one, type SP } from "@/lib/list-params";
import { getBusinessSettings } from "@/lib/settings";
import { listLocations } from "@/server/inventory";
import { listStockItemOptions, listSuppliers } from "@/server/purchasing";
import { createPoAction } from "../actions";

export const metadata = { title: "New purchase order" };

export default async function NewPoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requireActor();
  requirePermission(actor, "purchasing:write");
  const sp = await searchParams;
  const [business, suppliers, locs, items] = await Promise.all([getBusinessSettings(), listSuppliers(actor), listLocations(actor), listStockItemOptions(actor)]);
  const active = locs.filter((l) => l.isActive);
  return (
    <>
      <PageHeader title="New purchase order" description="Saved as a draft. Mark it as sent once the supplier has it; goods are received against it later." />
      <Panel>
        <PoForm
          action={createPoAction}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
          locations={active.map((l) => ({ id: l.id, name: l.name }))}
          items={items}
          currency={business.currency}
          showCosts={can(actor, "production:view_costs")}
          initial={{ supplierId: one(sp.supplierId) ?? "", locationId: active.find((l) => l.kind === "workshop")?.id ?? "", expectedOn: "", notes: "", lines: [] }}
          submitLabel="Save draft"
        />
      </Panel>
    </>
  );
}
