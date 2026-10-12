import { CustomerForm } from "@/components/app/customer-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { createCustomerAction } from "../actions";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  requirePermission(await requireActor(), "customers:write");
  return (
    <>
      <PageHeader title="Add customer" description="You will be warned if the phone number or email matches someone already on file." />
      <Panel>
        <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
      </Panel>
    </>
  );
}
