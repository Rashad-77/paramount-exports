import "server-only";
import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { phoneKey } from "@/lib/contact";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { messages, productVariants, products, uploadedFiles } from "@/lib/db/schema";
import { notFound, rateLimited, validation } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import type { EnquiryInput } from "@/lib/schemas/enquiry";
import { recordAudit } from "./audit";
import { linkUploads, verifyUploads } from "./files";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const ENQUIRY_LIMITS = {
  perIp: { limit: 5, windowSeconds: 600 },
  perPhone: { limit: 3, windowSeconds: 3600 },
} as const;

/**
 * Public contact form, product enquiry or custom-furniture request, stored as a message for staff to answer.
 * Callers must have passed the form guard (honeypot / token / Turnstile) already.
 */
export async function submitEnquiry(input: EnquiryInput, ctx: { ip: string | null }): Promise<{ id: string; reference: string }> {
  const db = getDb();
  const key = phoneKey(input.phone);

  const ipHit = await hitRateLimit(db, { scope: "enquiry-ip", value: ctx.ip ?? "unknown", ...ENQUIRY_LIMITS.perIp });
  if (!ipHit.allowed) throw rateLimited("You have sent several messages recently. Please wait a few minutes, or call us instead.");
  const phoneHit = await hitRateLimit(db, { scope: "enquiry-phone", value: key, ...ENQUIRY_LIMITS.perPhone });
  if (!phoneHit.allowed) throw rateLimited("We already have several messages from this phone number. We will be in touch shortly.");

  // The product must exist and be public; a message cannot be attached to a hidden or archived item.
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

  const verified = await verifyUploads(input.fileIds, "enquiry", null);
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
    const [{ ref }] = (await tx.execute(sql`SELECT next_reference('message') AS ref`)) as unknown as [{ ref: string }];
    const [row] = await tx
      .insert(messages)
      .values({
        reference: ref,
        kind: input.kind,
        name: input.name,
        phone: input.phone,
        phoneKey: key,
        email: input.email ?? null,
        preferredContact: input.preferredContact ?? null,
        message: input.message ?? null,
        productId,
        variantId,
        payload,
      })
      .returning({ id: messages.id, reference: messages.reference });
    await linkUploads(tx, verified, { type: "message", id: row!.id });
    await recordAudit(tx, null, { action: "message.received_from_website", entityType: "message", entityId: row!.id, after: { reference: row!.reference, kind: input.kind, files: verified.length } });
    return { id: row!.id, reference: row!.reference };
  });
}

/* ───────────────────────────── staff ───────────────────────────── */

export interface MessageFilters {
  state?: "open" | "handled";
  q?: string;
  page: number;
  pageSize: number;
}

export async function listMessages(actor: Actor, f: MessageFilters) {
  requirePermission(actor, "messages:view");
  const where: SQL[] = [];
  if (f.state === "open") where.push(eq(messages.isHandled, false));
  if (f.state === "handled") where.push(eq(messages.isHandled, true));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(messages.reference, like), ilike(messages.name, like), ilike(messages.phone, like), ilike(messages.email, like), ilike(messages.message, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [totalRow], [openRow]] = await Promise.all([
    db
      .select({
        id: messages.id,
        reference: messages.reference,
        kind: messages.kind,
        isHandled: messages.isHandled,
        name: messages.name,
        phone: messages.phone,
        message: messages.message,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(cond)
      .orderBy(desc(messages.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(messages).where(cond),
    db.select({ n: count() }).from(messages).where(eq(messages.isHandled, false)),
  ]);
  const total = totalRow?.n ?? 0;
  return { rows, total, open: openRow?.n ?? 0, pageCount: Math.max(1, Math.ceil(total / f.pageSize)) };
}

export async function getMessage(actor: Actor, id: string) {
  requirePermission(actor, "messages:view");
  const db = getDb();
  const [m] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!m) throw notFound("That message could not be found.");
  const [product] = m.productId ? await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, m.productId)).limit(1) : [];
  const files = await db
    .select({ id: uploadedFiles.id, name: uploadedFiles.originalName, size: uploadedFiles.sizeBytes })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, "message"), eq(uploadedFiles.entityId, id), eq(uploadedFiles.status, "linked")));
  return { message: m, product: product ?? null, files };
}

export async function setMessageHandled(actor: Actor, id: string, handled: boolean): Promise<void> {
  requirePermission(actor, "messages:handle");
  await withTx(async (tx) => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, id)).for("update");
    if (!m) throw notFound("That message could not be found.");
    await tx
      .update(messages)
      .set({ isHandled: handled, handledAt: handled ? new Date() : null, handledBy: handled ? actor.id : null })
      .where(eq(messages.id, id));
    await recordAudit(tx, actor, { action: handled ? "message.handled" : "message.reopened", entityType: "message", entityId: id, before: { isHandled: m.isHandled }, after: { isHandled: handled } });
  });
}
