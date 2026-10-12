import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { normaliseEmail, phoneKey } from "@/lib/contact";
import { getDb, withTx } from "@/lib/db/client";
import { customers, leads, productVariants, products } from "@/lib/db/schema";
import { rateLimited, validation } from "@/lib/errors";
import type { EnquiryInput } from "@/lib/schemas/enquiry";
import { hitRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "./audit";
import { linkUploads, verifyUploads } from "./files";
import { getDefaultAssigneeId } from "./settings";

export const ENQUIRY_LIMITS = {
  perIp: { limit: 5, windowSeconds: 600 },
  perPhone: { limit: 3, windowSeconds: 3600 },
} as const;

/**
 * Public enquiry → CRM lead. Never creates a customer automatically (so spam cannot pollute the customer list);
 * if an existing customer matches the phone/email it is only FLAGGED for staff to review.
 * Callers must have passed the form guard (honeypot / token / Turnstile) already.
 */
export async function submitEnquiry(input: EnquiryInput, ctx: { ip: string | null }): Promise<{ leadId: string; reference: string }> {
  const db = getDb();
  const key = phoneKey(input.phone);
  const emailLower = input.email ? normaliseEmail(input.email) : null;

  const ipHit = await hitRateLimit(db, { scope: "enquiry-ip", value: ctx.ip ?? "unknown", ...ENQUIRY_LIMITS.perIp });
  if (!ipHit.allowed) throw rateLimited("You have sent several enquiries recently. Please wait a few minutes, or call us instead.");
  const phoneHit = await hitRateLimit(db, { scope: "enquiry-phone", value: key, ...ENQUIRY_LIMITS.perPhone });
  if (!phoneHit.allowed) throw rateLimited("We already have several enquiries from this phone number. We will be in touch shortly.");

  // The product must exist and be public; an enquiry cannot be attached to a hidden or archived item.
  let productId: string | null = null;
  let variantId: string | null = null;
  if (input.productId) {
    const [p] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.isPublished, true), isNull(products.archivedAt)))
      .limit(1);
    if (!p) throw validation("That product is no longer available. Please choose another or contact us directly.");
    productId = p.id;
    if (input.variantId) {
      const [v] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.id, input.variantId), eq(productVariants.productId, p.id), eq(productVariants.isActive, true)))
        .limit(1);
      variantId = v?.id ?? null;
    }
  }

  const [dup] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(isNull(customers.archivedAt), emailLower ? or(eq(customers.phoneKey, key), eq(customers.emailLower, emailLower)) : eq(customers.phoneKey, key)))
    .limit(1);

  const verified = await verifyUploads(input.fileIds, "enquiry", null);
  const assignee = await getDefaultAssigneeId(db);

  const payload =
    input.kind === "custom"
      ? {
          furnitureType: input.furnitureType ?? null,
          dimensions: input.dimensions ?? null,
          material: input.material ?? null,
          finish: input.finish ?? null,
          budgetRange: input.budgetRange ?? null,
          targetDate: input.targetDate ?? null,
        }
      : null;

  return withTx(async (tx) => {
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('lead') AS ref`)) as unknown as [{ ref: string }];
    const [lead] = await tx
      .insert(leads)
      .values({
        reference: ref,
        kind: input.kind,
        source: "website",
        assignedTo: assignee,
        contactName: input.name,
        contactPhone: input.phone,
        contactPhoneKey: key,
        contactEmail: input.email ?? null,
        contactEmailLower: emailLower,
        preferredContact: input.preferredContact ?? null,
        message: input.message ?? null,
        productId,
        variantId,
        payload,
        possibleDuplicateCustomerId: dup?.id ?? null,
      })
      .returning({ id: leads.id, reference: leads.reference });
    await linkUploads(tx, verified, { type: "lead", id: lead!.id });
    await recordAudit(tx, null, { action: "lead.created_from_website", entityType: "lead", entityId: lead!.id, after: { reference: lead!.reference, kind: input.kind, files: verified.length } });
    return { leadId: lead!.id, reference: lead!.reference };
  });
}
