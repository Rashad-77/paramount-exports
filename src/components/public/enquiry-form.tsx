"use client";

import Script from "next/script";
import { Suspense, useEffect, useState } from "react";
import { ActionForm, FCheckbox, FField, FSelect, FTextArea, SubmitButton } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { submitEnquiryAction } from "@/app/(public)/enquiry-actions";
import { PrefillFromAccount } from "@/components/public/prefill-from-account";
import { QuotePrefill } from "@/components/public/quote-prefill";
import { HONEYPOT_FIELD } from "@/lib/form-guard-constants";

export interface VariantOption {
  id: string;
  label: string;
}

const CONTACT_OPTIONS = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
];

/**
 * One form component for the three public enquiry types. Anti-spam: hidden honeypot, a signed time-stamped
 * token fetched when the form mounts (so cached pages never contain a stale one), optional Turnstile.
 */
export function EnquiryForm({
  kind,
  productId,
  variants,
  turnstileSiteKey,
  submitLabel = "Send enquiry",
  wide = false,
}: {
  kind: "general" | "product_enquiry" | "custom";
  productId?: string;
  variants?: VariantOption[];
  turnstileSiteKey?: string;
  submitLabel?: string;
  /** Spread across the full width: name, phone and email in one row, the tick and the button on one line. */
  wide?: boolean;
}) {
  const [token, setToken] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/form-token", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { token: string }) => alive && setToken(j.token))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ActionForm action={submitEnquiryAction} hideOnSuccess successTitle="Thank you">
      {turnstileSiteKey ? <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" /> : null}
      <PrefillFromAccount />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="formToken" value={token} />
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {kind === "custom" ? (
        <Suspense fallback={null}>
          <QuotePrefill />
        </Suspense>
      ) : null}

      {/* Honeypot: visually hidden and skipped by keyboard and screen readers; humans never fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className={wide ? (variants && variants.length > 1 ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-5 sm:grid-cols-3") : "grid gap-5 sm:grid-cols-2"}>
        <FField name="name" label="Your name" autoComplete="name" maxLength={120} required />
        <FField name="phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required />
        <FField name="email" label="Email" type="email" autoComplete="email" inputMode="email" maxLength={200} />
        {wide ? null : <FSelect name="preferredContact" label="Best way to reach you" options={CONTACT_OPTIONS} placeholder="No preference" />}
        {wide && variants && variants.length > 1 ? <FSelect name="variantId" label="Option" options={variants.map((v) => ({ value: v.id, label: v.label }))} placeholder="Not sure yet" /> : null}
      </div>

      {!wide && variants && variants.length > 1 ? (
        <FSelect name="variantId" label="Option" options={variants.map((v) => ({ value: v.id, label: v.label }))} placeholder="Not sure yet" />
      ) : variants?.length === 1 ? (
        <input type="hidden" name="variantId" value={variants[0]!.id} />
      ) : null}

      {kind === "custom" ? (
        <fieldset className="space-y-5">
          <legend className="font-display text-lg text-walnut">About the piece</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <FField name="furnitureType" label="What would you like made?" placeholder="e.g. dining table, wardrobe" maxLength={120} required />
            <FField name="dimensions" label="Dimensions" placeholder="e.g. 180 × 90 × 75 cm" maxLength={200} />
            <FField name="material" label="Wood or material" placeholder="If you have a preference" maxLength={120} />
            <FField name="finish" label="Finish" placeholder="e.g. natural oil, dark stain" maxLength={120} />
            <FField name="budgetRange" label="Budget range" maxLength={80} />
            <FField name="targetDate" label="Date you would like it by" type="date" min={new Date().toISOString().slice(0, 10)} />
          </div>
          <FileUploader purpose="enquiry" label="Reference photos or sketches" hint="JPEG, PNG or WebP, up to 8 MB each, up to 5 files." maxFiles={5} />
        </fieldset>
      ) : null}

      <FTextArea
        name="message"
        label={kind === "custom" ? "Anything else we should know?" : "Your message"}
        required={kind === "general"}
        rows={kind === "custom" ? 4 : wide ? 3 : 5}
        maxLength={2000}
      />

      {turnstileSiteKey ? <div className="cf-turnstile" data-sitekey={turnstileSiteKey} /> : null}

      <div className={wide ? "flex flex-col gap-5 md:flex-row md:items-center md:justify-between" : "space-y-5"}>
        <FCheckbox name="consent" label="I agree to be contacted about this enquiry." hint="We use your details only to reply to you. See the Privacy notice." />
        <SubmitButton size="cta" pendingLabel="Sending…" className={wide ? "shrink-0" : undefined}>
          {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
