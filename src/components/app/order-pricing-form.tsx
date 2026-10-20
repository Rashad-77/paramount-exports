import { updateDetailsAction } from "@/app/app/orders/actions";
import { ActionForm, FField, SubmitButton } from "@/components/forms/action-form";

/**
 * Pricing for an open order: the delivery charge (deliveries only) and a discount with its reason (owner only).
 * The total is items minus discount plus delivery.
 */
export function OrderPricingForm({
  orderId,
  currency,
  delivery,
  deliveryCharge,
  deliveryChargeSet,
  discount,
  discountReason,
  canDiscount,
}: {
  orderId: string;
  currency: string;
  delivery: boolean;
  deliveryCharge: string;
  deliveryChargeSet: boolean;
  discount: string;
  discountReason: string | null;
  canDiscount: boolean;
}) {
  return (
    <ActionForm action={updateDetailsAction} className="space-y-4">
      <input type="hidden" name="id" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {delivery ? (
          <FField
            name="deliveryCharge"
            label={`Delivery charge (${currency})`}
            inputMode="decimal"
            defaultValue={deliveryChargeSet ? String(Number(deliveryCharge)) : ""}
            hint={deliveryChargeSet ? undefined : "Required before the order can be confirmed. Enter 0 if delivery is free."}
          />
        ) : null}
        {canDiscount ? (
          <>
            <FField name="discountAmount" label={`Discount (${currency})`} inputMode="decimal" defaultValue={Number(discount) > 0 ? String(Number(discount)) : ""} hint="An amount off the items." />
            <FField name="discountPercent" label="Or discount (%)" inputMode="decimal" hint="A percentage of the items. Fill one of the two." />
            <FField name="discountReason" label="Why the discount" maxLength={200} defaultValue={discountReason ?? ""} />
          </>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Saving…">Save pricing</SubmitButton>
    </ActionForm>
  );
}
