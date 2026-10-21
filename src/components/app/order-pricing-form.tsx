import { updateDetailsAction } from "@/app/app/orders/actions";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";

/**
 * Pricing for an open order: the delivery charge. The total is items minus any discount plus delivery.
 */
export function OrderPricingForm({
  orderId,
  currency,
  deliveryCharge,
  deliveryChargeSet,
}: {
  orderId: string;
  currency: string;
  deliveryCharge: string;
  deliveryChargeSet: boolean;
}) {
  return (
    <ActionForm action={updateDetailsAction} className="space-y-4">
      <input type="hidden" name="id" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FField
          name="deliveryCharge"
          label={`Delivery charge (${currency})`}
          kind="money"
          defaultValue={deliveryChargeSet ? String(Number(deliveryCharge)) : ""}
          hint={deliveryChargeSet ? undefined : "Required before the order can be confirmed. Enter 0 if delivery is free."}
        />
      </div>
      <SubmitButton pendingLabel="Saving…">Save pricing</SubmitButton>
    </ActionForm>
  );
}
