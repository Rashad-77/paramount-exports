import { ActionForm, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/lib/schemas/orders";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";
import { listExpenseCategories } from "@/server/expenses";
import { createExpenseAction } from "../actions";

export const metadata = { title: "Record an expense" };

export default async function NewExpensePage() {
  const actor = await requireActor();
  requirePermission(actor, "expenses:write");
  const [business, cats] = await Promise.all([getBusinessSettings(), listExpenseCategories(actor)]);
  return (
    <>
      <PageHeader title="Record an expense" description="Attach the receipt if you have one. Once saved, an expense can only be voided, not edited." />
      <Panel>
        <ActionForm action={createExpenseAction}>
          <div className="grid gap-5 md:grid-cols-2">
            <FField name="spentOn" label="Date" type="date" required defaultValue={todayLocal(business.timezone)} />
            <FSelect name="categoryId" label="Category" required placeholder="Choose a category" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
            <FField name="amount" label={`Amount (${business.currency})`} required inputMode="decimal" />
            <FSelect name="method" label="Paid by" required defaultValue="cash" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))} />
            <FField name="payee" label="Paid to" />
            <FField name="reference" label="Reference" hint="Receipt or transfer number" />
          </div>
          <FTextArea name="description" label="What was it for?" required rows={2} />
          <FileUploader name="fileIds" purpose="expense" label="Receipt or invoice" accept="image/jpeg,image/png,image/webp,application/pdf" maxFiles={5} />
          <SubmitButton>Save expense</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
