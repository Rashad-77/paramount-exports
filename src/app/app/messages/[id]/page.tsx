import Link from "next/link";
import { addressStacked } from "@/lib/address-lines";
import { notFound } from "next/navigation";
import { plainPhone } from "@/lib/contact";
import type { ReactNode } from "react";
import { FlowPanel } from "@/components/app/flow-panel";
import { EnquiryTag } from "@/components/app/tags";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  CONTACT_CHOICE_LABEL,
  PIECE_FIELDS,
  STAFF_CONTACT_LABELS,
  STAFF_CUSTOM_MESSAGE_LABEL,
  STAFF_MESSAGE_LABEL,
  STAFF_PHOTOS_LABEL,
  STAFF_PIECE_HEADING,
  STAFF_PIECE_LABELS,
} from "@/lib/enquiry-form-labels";
import { isAppError } from "@/lib/errors";
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { quoteRef } from "@/lib/quotation-ui";
import { enquiryNextStep, enquirySteps } from "@/lib/enquiry-flow";
import { getBusinessSettings } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/time";
import { getMessage } from "@/server/messages";
import { setEnquiryStateAction } from "../actions";

export const metadata = { title: "Message" };

/** One answer on the form: its question above, the customer's answer below ("Not given" when left blank). */
function Field({ label, children, wide }: { label: string; children?: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm">{children ?? <span className="text-text-muted">Not given</span>}</dd>
    </div>
  );
}

/** A group of answers under a small heading. */
function Group({ title, children, last }: { title: string; children: ReactNode; last?: boolean }) {
  return (
    <fieldset className={"min-w-0 pb-6 " + (last ? "" : "mb-6 border-b border-border")}>
      <legend className="mb-3 font-display text-base text-walnut">{title}</legend>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
    </fieldset>
  );
}

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor();
  let data;
  try {
    data = await getMessage(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const business = await getBusinessSettings();
  const tz = business.timezone;
  const { message: m, product, files, accountAddress } = data;
  const custom = m.kind === "custom";
  const canHandle = can(actor, "messages:handle");
  const piece = (m.payload && typeof m.payload === "object" ? m.payload : {}) as Record<string, unknown>;
  const word = custom ? "request" : "enquiry";

  const respondedButton = canHandle ? (
    <ActionForm action={setEnquiryStateAction} className="space-y-0">
      <input type="hidden" name="id" value={m.id} />
      <input type="hidden" name="state" value={m.isHandled ? "new" : "responded"} />
      <SubmitButton variant={m.isHandled ? "secondary" : "primary"}>{m.isHandled ? "Move back to new" : "Mark as responded"}</SubmitButton>
    </ActionForm>
  ) : null;

  return (
    <>
      <PageHeader
        back={{ href: custom ? "/app/quotations" : "/app/enquiries", to: custom ? "quotations" : "enquiries" }}
        title={custom ? quoteRef(m.reference) : m.reference}
        description={`${MESSAGE_KIND_LABEL[m.kind] ?? m.kind} · received ${formatDateTime(m.createdAt, tz)}`}
        badges={<EnquiryTag state={m.isHandled ? "responded" : "new"} />}
        actions={respondedButton}
      />

      <FlowPanel
        label={`How this ${word} works`}
        steps={enquirySteps({ createdAt: m.createdAt, handledAt: m.handledAt, isHandled: m.isHandled }, custom ? "Request received" : "Enquiry received")}
        note={custom ? (m.isHandled ? "This request has been answered. Nothing more to do." : "Contact the customer by phone or email to discuss the request, then press “Mark as responded”.") : enquiryNextStep(m.isHandled)}
        timezone={tz}
      />

      <div className="space-y-6">
        <section className="min-w-0 border border-border bg-surface p-5">
          <h3 className="mb-5 text-sm font-semibold text-walnut">{custom ? "Customer request" : "Customer enquiry"}</h3>

          <Group title="Contact">
            <Field label={STAFF_CONTACT_LABELS.name}>{m.name}</Field>
            <Field label={STAFF_CONTACT_LABELS.phone}>
              <a className="underline" href={`tel:${m.phone.replace(/\s+/g, "")}`}>
                {plainPhone(m.phone)}
              </a>
            </Field>
            <Field label={STAFF_CONTACT_LABELS.email}>{m.email ? <a className="break-all underline" href={`mailto:${m.email}`}>{m.email}</a> : null}</Field>
            <Field label={STAFF_CONTACT_LABELS.preferredContact}>{m.preferredContact ? (CONTACT_CHOICE_LABEL[m.preferredContact] ?? m.preferredContact) : "No preference"}</Field>
            {accountAddress ? <Field label="Address saved on their account">{addressStacked(accountAddress)}</Field> : null}
          </Group>

          {custom ? (
            <Group title={STAFF_PIECE_HEADING}>
              {PIECE_FIELDS.map((f) => {
                const raw = piece[f.key];
                return (
                  <Field key={f.key} label={STAFF_PIECE_LABELS[f.key]}>
                    {raw ? (f.key === "targetDate" ? formatDate(String(raw), "UTC") : String(raw)) : null}
                  </Field>
                );
              })}
              {product ? (
                <Field label="Asked from the product" wide>
                  <Link href={`/app/products/${product.id}`} className="font-medium text-walnut underline">
                    {product.name}
                  </Link>
                </Field>
              ) : null}
              <Field label={STAFF_PHOTOS_LABEL} wide>
                {files.length > 0 ? (
                  <ul className="space-y-1">
                    {files.map((f) => (
                      <li key={f.id}>
                        <a className="underline" href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer">
                          {f.name}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Field>
            </Group>
          ) : product ? (
            <Group title="Product">
              <Field label="Enquiry about" wide>
                <Link href={`/app/products/${product.id}`} className="font-medium text-walnut underline">
                  {product.name}
                </Link>
              </Field>
            </Group>
          ) : null}

          <Group title={custom ? STAFF_CUSTOM_MESSAGE_LABEL : STAFF_MESSAGE_LABEL} last>
            <p className="col-span-full whitespace-pre-line border border-border bg-linen px-4 py-3 text-base">{m.message ?? <span className="text-text-muted">Not given</span>}</p>
          </Group>
        </section>
      </div>
    </>
  );
}
