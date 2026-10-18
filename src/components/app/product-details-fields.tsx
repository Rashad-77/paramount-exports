"use client";

import { useState } from "react";
import { FCheckbox, FField, FSelect } from "@/components/forms/action-form";
import { AVAILABILITY, AVAILABILITY_LABEL, VISIBILITY, VISIBILITY_LABEL } from "@/lib/schemas/catalogue";

/** Visibility, availability and price: what the website shows and sells. An amount in stock is asked for when the piece is in stock. */
export function DetailsFields({
  visibility,
  isFeatured,
  isPremium,
  availability,
  stockQuantity,
  price,
  currency,
}: {
  visibility: string;
  isFeatured?: boolean;
  isPremium?: boolean;
  availability?: string | null;
  stockQuantity?: number | null;
  price?: string | null;
  currency: string;
}) {
  const [avail, setAvail] = useState(availability ?? "");
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
          <FField name="stockQuantity" label="Available amount" required inputMode="numeric" defaultValue={stockQuantity ?? ""} hint="How many are in stock. Orders take from this." />
        ) : null}
      </div>

      <FField name="listPrice" label={`Price (${currency})`} inputMode="decimal" defaultValue={price ?? ""} hint="Shown on the website when entered. Leave blank if it is not priced yet; customers can then ask for a quotation." className="max-w-md" />
    </div>
  );
}
