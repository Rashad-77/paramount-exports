"use client";

import { useState } from "react";
import { FCheckbox, FField, FSelect } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { AVAILABILITY, AVAILABILITY_LABEL, VISIBILITY, VISIBILITY_LABEL } from "@/lib/schemas/catalogue";

/** Visibility, availability and price: what the website shows and sells. An amount in stock is asked for when the piece is in stock. */
export function DetailsFields({
  visibility,
  isFeatured,
  isPremium,
  availability,
  stockQuantity,
  price,
  discountKind,
  discountValue,
  currency,
}: {
  visibility: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  availability?: string | null;
  stockQuantity?: number | null;
  /** The regular price (before any discount). */
  price?: string | null;
  discountKind?: string | null;
  discountValue?: string | null;
  currency: string;
}) {
  const [avail, setAvail] = useState(availability ?? "");
  const [discountOpen, setDiscountOpen] = useState(Boolean(discountKind));
  const savedKind = discountKind === "percent" ? "percent" : "amount";
  const [kind, setKind] = useState(savedKind);
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <FSelect
          name="visibility"
          label="Visibility"
          required
          defaultValue={visibility}
          options={VISIBILITY.map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
          hint="Archiving hides the product from the website and keeps it on record. Restore it by choosing Draft or Published."
        />
        <div className="flex flex-wrap gap-x-8 gap-y-1">
          <FCheckbox name="isFeatured" label="Featured on the homepage" defaultChecked={isFeatured} />
          <FCheckbox name="isPremium" label="Premium range" hint="Shown in the premium range only when Featured is ticked too." defaultChecked={isPremium} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <FSelect
          name="availability"
          label="Availability"
          defaultValue={availability ?? ""}
          placeholder="Not shown"
          options={AVAILABILITY.map((a) => ({ value: a, label: AVAILABILITY_LABEL[a] }))}
          value={avail}
          onValueChange={setAvail}
          hint="Shown to customers on the product page."
        />
        {avail === "in_stock" ? (
          <FField name="stockQuantity" label="Available amount" required kind="integer" defaultValue={stockQuantity ?? ""} hint="How many are in stock. Orders take from this." />
        ) : null}
      </div>

      <FField name="listPrice" label={`Price (${currency})`} kind="money" defaultValue={price ?? ""} hint="The regular price, shown on the website when entered. Leave it blank for a piece that cannot be priced easily (timber, for example): its page then shows a Request quotation button instead of a price." className="max-w-md" />

      {discountOpen ? (
        <div className="max-w-md space-y-4 border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Discount</h3>
            <button type="button" onClick={() => setDiscountOpen(false)} className="min-h-10 px-1 text-sm underline">
              Remove discount
            </button>
          </div>
          <FSelect
            name="discountKind"
            label="Discount type"
            required
            defaultValue={kind}
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "amount", label: `Amount off (${currency})` },
              { value: "percent", label: "Percentage off (%)" },
            ]}
          />
          <FField
            key={kind}
            name="discountValue"
            label={kind === "percent" ? "Percentage off" : `Amount off (${currency})`}
            kind={kind === "percent" ? "percent" : "money"}
            required
            // The saved number belongs to the saved type; choosing the other type starts the box empty.
            defaultValue={kind === savedKind ? (discountValue ?? "") : ""}
            hint={kind === "percent" ? "The label on the website says this percentage, for example 20% off." : "The label on the website says this amount, for example LKR 5,000 off."}
          />
          <p className="text-xs text-text-muted">Customers see the regular price struck through, the price after the discount, and a Sale label.</p>
        </div>
      ) : (
        <div>
          <Button type="button" variant="secondary" onClick={() => setDiscountOpen(true)}>
            Add discount
          </Button>
        </div>
      )}
    </div>
  );
}
