import { SupplierForm } from "@/components/app/supplier-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";

export const metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  const actor = await requireActor();
  requirePermission(actor, "suppliers:write");
  return (
    <>
      <PageHeader title="New supplier" />
      <Panel><SupplierForm /></Panel>
    </>
  );
}
