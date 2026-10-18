import { QuoteTag, EnquiryTag } from "@/components/app/tags";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ActionForm,
  FField,
  FSelect,
  FTextArea,
  SubmitButton,
} from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { MESSAGE_KIND_LABEL } from "@/lib/order-ui";
import { getBusinessSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/time";
import { getMessage } from "@/server/messages";
import { formatMoney } from "@/lib/money";
import { FULFILMENT_LABEL, PAYMENT_LABEL } from "@/lib/order-constants";
import { isQuoteStatus, quoteRef } from "@/lib/quotation-ui";
import { ButtonLink } from "@/components/ui/button";
import {
  closeQuotationAction,
  createOrderFromQuotationAction,
  sendQuoteAction,
  setEnquiryStateAction,
  setHandledAction,
  startReviewAction,
} from "../actions";

const STAFF_QUOTE_LABEL: Record<string, string> = {
  requested: "Waiting for a price",
  under_review: "Being reviewed, waiting for a price",
  quoted: "Price sent, waiting for the customer",
  accepted: "Accepted by the customer",
  declined: "Declined by the customer",
  cancelled: "Closed",
};

export const metadata = { title: "Message" };

const CUSTOM_LABELS: Record<string, string> = {
  furnitureType: "What they want made",
  dimensions: "Dimensions",
  material: "Wood or material",
  finish: "Finish",
  budgetRange: "Budget",
  targetDate: "Wanted by",
};

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  const { message: m, product, files, order, accountAddress } = data;
  const quote = isQuoteStatus(m.quoteStatus) ? m.quoteStatus : null;
  const canQuote = can(actor, "messages:handle");
  const details =
    m.payload && typeof m.payload === "object"
      ? Object.entries(m.payload as Record<string, unknown>).filter(
          ([, v]) => v,
        )
      : [];

  return (
    <>
      <PageHeader back={{ href: "/app/messages", to: "messages" }}
        title={m.kind === "custom" ? quoteRef(m.reference) : m.reference}
        description={`${MESSAGE_KIND_LABEL[m.kind] ?? m.kind} · received ${formatDateTime(m.createdAt, business.timezone)}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {m.kind === "custom" && quote ? (
              <QuoteTag status={quote} />
            ) : m.isHandled ? (
              <EnquiryTag state="responded" />
            ) : (
              <EnquiryTag state="new" />
            )}
            <ButtonLink
              href={m.kind === "custom" ? "/app/quotations" : "/app/enquiries"}
              variant="secondary"
            >
              {m.kind === "custom" ? "All quotations" : "All enquiries"}
            </ButtonLink>
          </div>
        }
      />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Panel title="Message">
            <p className="whitespace-pre-line text-base">
              {m.message ?? "No message was written."}
            </p>
            {product ? (
              <p className="mt-4 text-sm text-text-muted">
                About the product:{" "}
                <span className="font-medium text-text">{product.name}</span>
              </p>
            ) : null}
          </Panel>
          {details.length > 0 ? (
            <Panel title="Custom furniture details">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {details.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-text-muted">{CUSTOM_LABELS[k] ?? k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}
          {m.kind === "custom" && quote ? (
            <Panel title="Quotation" description={STAFF_QUOTE_LABEL[quote]}>
              {m.quotedAmount ? (
                <p className="mb-5 text-sm">
                  Price sent:{" "}
                  <span className="font-semibold">
                    {formatMoney(m.quotedAmount, business.currency)}
                  </span>
                  {m.quoteValidUntil ? (
                    <span className="text-text-muted">
                      {" "}
                      · valid until {m.quoteValidUntil}
                    </span>
                  ) : null}
                  {m.quoteNote ? (
                    <span className="mt-1 block whitespace-pre-line text-text-muted">
                      {m.quoteNote}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {quote === "declined" && m.declineReason ? (
                <p className="mb-5 text-sm text-text-muted">
                  Their reason: {m.declineReason}
                </p>
              ) : null}

              {canQuote &&
              (quote === "requested" ||
                quote === "under_review" ||
                quote === "quoted" ||
                quote === "declined") ? (
                <ActionForm action={sendQuoteAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FField
                      name="amount"
                      label={`Price (${business.currency})`}
                      inputMode="decimal"
                      placeholder="e.g. 185000"
                      required
                      defaultValue={m.quotedAmount ?? ""}
                    />
                    <FField
                      name="validUntil"
                      label="Price valid until"
                      type="date"
                      defaultValue={m.quoteValidUntil ?? ""}
                    />
                  </div>
                  <FTextArea
                    name="note"
                    label="Note to the customer"
                    rows={3}
                    maxLength={1500}
                    defaultValue={m.quoteNote ?? ""}
                    hint="What the price includes, how long it will take, and so on."
                  />
                  <SubmitButton pendingLabel="Sending…">
                    {quote === "requested" || quote === "under_review"
                      ? "Send price to customer"
                      : "Send a new price"}
                  </SubmitButton>
                </ActionForm>
              ) : null}

              {canQuote && quote === "accepted" && !order ? (
                <ActionForm action={createOrderFromQuotationAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <p className="text-sm text-text-muted">
                    The customer accepted this price. Confirm the order with
                    them, then make it here.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FSelect
                      name="fulfilment"
                      label="Delivery or collection"
                      defaultValue="delivery"
                      options={Object.entries(FULFILMENT_LABEL).map(
                        ([value, label]) => ({ value, label }),
                      )}
                      required
                    />
                    <FSelect
                      name="paymentMethod"
                      label="Payment"
                      defaultValue="on_delivery"
                      options={Object.entries(PAYMENT_LABEL).map(
                        ([value, label]) => ({ value, label }),
                      )}
                      required
                    />
                  </div>
                  <FTextArea
                    name="address"
                    label="Delivery address"
                    rows={3}
                    maxLength={400}
                    defaultValue={accountAddress ?? ""}
                    hint="Leave blank for collection."
                  />
                  <SubmitButton pendingLabel="Making the order…">
                    Create confirmed order
                  </SubmitButton>
                </ActionForm>
              ) : null}

              {order ? (
                <p className="text-sm">
                  Order made from this quotation:{" "}
                  <Link
                    href={`/app/orders/${order.id}`}
                    className="font-medium underline"
                  >
                    {order.reference}
                  </Link>
                </p>
              ) : null}

              {canQuote &&
              (quote === "requested" ||
                quote === "under_review" ||
                quote === "quoted") ? (
                <ActionForm
                  action={closeQuotationAction}
                  className="mt-6 border-t border-border pt-5"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <FField
                    name="reason"
                    label="Reason for closing (shown to the customer)"
                    maxLength={500}
                  />
                  <SubmitButton variant="secondary" pendingLabel="Closing…">
                    Close this quotation
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </Panel>
          ) : null}
          {files.length > 0 ? (
            <Panel title="Pictures">
              <ul className="space-y-1.5 text-sm">
                {files.map((f) => (
                  <li key={f.id}>
                    <a
                      className="underline"
                      href={`/api/files/${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {f.name}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Reply to">
            <p className="font-medium">{m.name}</p>
            <p className="mt-1 text-sm">
              <a
                className="underline"
                href={`tel:${m.phone.replace(/\s+/g, "")}`}
              >
                {m.phone}
              </a>
            </p>
            {m.email ? (
              <p className="text-sm">
                <a className="underline" href={`mailto:${m.email}`}>
                  {m.email}
                </a>
              </p>
            ) : null}
            {m.preferredContact ? (
              <p className="mt-3 text-sm text-text-muted">
                Prefers: {m.preferredContact}
              </p>
            ) : null}
          </Panel>
          {can(actor, "messages:handle") &&
          m.kind === "custom" &&
          quote === "requested" ? (
            <Panel
              title="Start on this request"
              description="Move it to under review while you work out the price."
            >
              <ActionForm action={startReviewAction} className="space-y-0">
                <input type="hidden" name="id" value={m.id} />
                <SubmitButton>Start review</SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
          {can(actor, "messages:handle") && m.kind !== "custom" ? (
            <Panel
              title="Where this enquiry stands"
              description="Keep it up to date so the team can see what still needs an answer."
            >
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["new", "New", !m.isHandled],
                    ["responded", "Responded", m.isHandled],
                  ] as const
                ).map(([state, label, current]) => (
                  <ActionForm
                    key={state}
                    action={setEnquiryStateAction}
                    className="space-y-0"
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="state" value={state} />
                    <SubmitButton variant={current ? "primary" : "secondary"}>
                      {label}
                    </SubmitButton>
                  </ActionForm>
                ))}
              </div>
            </Panel>
          ) : null}
          {can(actor, "messages:handle") && m.kind === "custom" ? (
            <Panel title={m.isHandled ? "Handled" : "When you have replied"}>
              <ActionForm action={setHandledAction} className="space-y-0">
                <input type="hidden" name="id" value={m.id} />
                {m.isHandled ? null : (
                  <input type="hidden" name="handled" value="true" />
                )}
                <SubmitButton variant={m.isHandled ? "secondary" : "primary"}>
                  {m.isHandled ? "Move back to open" : "Mark as handled"}
                </SubmitButton>
              </ActionForm>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
