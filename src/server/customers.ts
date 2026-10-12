import "server-only";
import { outer } from "@/lib/db/outer";
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { normaliseEmail, phoneKey } from "@/lib/contact";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { customers, leadActivities, leads, quotations } from "@/lib/db/schema";
import { AppError, notFound, validation } from "@/lib/errors";
import type { CustomerInput } from "@/lib/schemas/crm";
import { recordAudit } from "./audit";
import { escapeLike } from "./leads";

export interface CustomerMatch {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  matchedOn: "phone" | "email" | "phone and email";
}

/** Existing active customers that share this phone (last 9 digits) or email. Used to WARN, never to merge. */
export async function findCustomerMatches(db: DbOrTx, phone: string, email: string | null | undefined, excludeId?: string): Promise<CustomerMatch[]> {
  const key = phoneKey(phone);
  const emailLower = email ? normaliseEmail(email) : null;
  const conds: SQL[] = [eq(customers.phoneKey, key)];
  if (emailLower) conds.push(eq(customers.emailLower, emailLower));
  const rows = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email, phoneKey: customers.phoneKey, emailLower: customers.emailLower })
    .from(customers)
    .where(and(isNull(customers.archivedAt), or(...conds), excludeId ? ne(customers.id, excludeId) : undefined))
    .limit(5);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    matchedOn: r.phoneKey === key && emailLower && r.emailLower === emailLower ? "phone and email" : r.phoneKey === key ? "phone" : "email",
  }));
}

function duplicateError(matches: CustomerMatch[]): AppError {
  const list = matches.map((m) => `${m.name} (same ${m.matchedOn})`).join(", ");
  const message = `This looks like an existing customer: ${list}. Open that record instead, or tick “Create anyway” if this is a different person.`;
  return new AppError("CONFLICT", message, { confirmDuplicate: [message] });
}

export interface CustomerFilters {
  q?: string;
  archived?: boolean;
  page: number;
  pageSize: number;
}

export async function listCustomers(actor: Actor, f: CustomerFilters) {
  requirePermission(actor, "customers:view");
  const where: SQL[] = [f.archived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt)];
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(customers.name, like), ilike(customers.company, like), ilike(customers.phone, like), ilike(customers.email, like))!);
  }
  const cond = and(...where);
  const db = getDb();
  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        company: customers.company,
        phone: customers.phone,
        email: customers.email,
        createdAt: customers.createdAt,
        leadCount: sql<number>`(SELECT count(*)::int FROM leads l WHERE l.customer_id = ${outer(customers.id)})`,
        quotationCount: sql<number>`(SELECT count(*)::int FROM quotations q WHERE q.customer_id = ${outer(customers.id)})`,
      })
      .from(customers)
      .where(cond)
      .orderBy(asc(customers.name))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(customers).where(cond),
  ]);
  const n = countRows[0]?.n ?? 0;
  return { rows, total: n, pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getCustomer(actor: Actor, id: string) {
  requirePermission(actor, "customers:view");
  const db = getDb();
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) throw notFound("That customer could not be found.");
  const [customerLeads, customerQuotations] = await Promise.all([
    db.select({ id: leads.id, reference: leads.reference, status: leads.status, kind: leads.kind, createdAt: leads.createdAt }).from(leads).where(eq(leads.customerId, id)).orderBy(desc(leads.createdAt)),
    db
      .select({ id: quotations.id, reference: quotations.reference, status: quotations.status, createdAt: quotations.createdAt })
      .from(quotations)
      .where(eq(quotations.customerId, id))
      .orderBy(desc(quotations.createdAt)),
  ]);
  return { customer, leads: customerLeads, quotations: customerQuotations };
}

export async function createCustomer(actor: Actor, input: CustomerInput): Promise<string> {
  requirePermission(actor, "customers:write");
  const db = getDb();
  if (!input.confirmDuplicate) {
    const matches = await findCustomerMatches(db, input.phone, input.email);
    if (matches.length) throw duplicateError(matches);
  }
  return withTx(async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({
        name: input.name,
        company: input.company ?? null,
        phone: input.phone,
        phoneKey: phoneKey(input.phone),
        email: input.email ?? null,
        emailLower: input.email ? normaliseEmail(input.email) : null,
        address: input.address ?? null,
        preferredContact: input.preferredContact ?? null,
        notes: input.notes ?? null,
        createdBy: actor.id,
      })
      .returning({ id: customers.id });
    await recordAudit(tx, actor, { action: "customer.created", entityType: "customer", entityId: c!.id, after: { name: input.name } });
    return c!.id;
  });
}

export async function updateCustomer(actor: Actor, id: string, input: CustomerInput): Promise<void> {
  requirePermission(actor, "customers:write");
  const db = getDb();
  const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!existing) throw notFound("That customer could not be found.");
  const contactChanged = phoneKey(input.phone) !== existing.phoneKey || (input.email ? normaliseEmail(input.email) : null) !== existing.emailLower;
  if (contactChanged && !input.confirmDuplicate) {
    const matches = await findCustomerMatches(db, input.phone, input.email, id);
    if (matches.length) throw duplicateError(matches);
  }
  await withTx(async (tx) => {
    await tx
      .update(customers)
      .set({
        name: input.name,
        company: input.company ?? null,
        phone: input.phone,
        phoneKey: phoneKey(input.phone),
        email: input.email ?? null,
        emailLower: input.email ? normaliseEmail(input.email) : null,
        address: input.address ?? null,
        preferredContact: input.preferredContact ?? null,
        notes: input.notes ?? null,
      })
      .where(eq(customers.id, id));
    await recordAudit(tx, actor, {
      action: "customer.updated",
      entityType: "customer",
      entityId: id,
      before: { name: existing.name, phone: existing.phone, email: existing.email },
      after: { name: input.name, phone: input.phone, email: input.email ?? null },
    });
  });
}

export async function setCustomerArchived(actor: Actor, id: string, archived: boolean): Promise<void> {
  requirePermission(actor, "customers:write");
  await withTx(async (tx) => {
    const [c] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).for("update");
    if (!c) throw notFound("That customer could not be found.");
    await tx.update(customers).set({ archivedAt: archived ? new Date() : null }).where(eq(customers.id, id));
    await recordAudit(tx, actor, { action: archived ? "customer.archived" : "customer.restored", entityType: "customer", entityId: id });
  });
}

/** Link an enquiry to a customer that already exists (the person chose it; nothing is merged or copied over). */
export async function linkLeadToCustomer(actor: Actor, leadId: string, customerId: string): Promise<void> {
  requirePermission(actor, "leads:write");
  requirePermission(actor, "customers:view");
  await withTx(async (tx) => {
    const [lead] = await tx.select({ id: leads.id, customerId: leads.customerId }).from(leads).where(eq(leads.id, leadId)).for("update");
    if (!lead) throw notFound("That enquiry could not be found.");
    const [c] = await tx.select({ id: customers.id, name: customers.name, archivedAt: customers.archivedAt }).from(customers).where(eq(customers.id, customerId)).limit(1);
    if (!c || c.archivedAt) throw validation("Choose an active customer.");
    await tx.update(leads).set({ customerId, possibleDuplicateCustomerId: null }).where(eq(leads.id, leadId));
    await tx.insert(leadActivities).values({ leadId, customerId, type: "note", body: `Linked to customer ${c.name}.`, createdBy: actor.id });
    await recordAudit(tx, actor, { action: "lead.linked_to_customer", entityType: "lead", entityId: leadId, before: { customerId: lead.customerId }, after: { customerId } });
  });
}

/** Create a customer from an enquiry's contact details and link the enquiry to it, in one transaction. */
export async function createCustomerFromLead(actor: Actor, leadId: string, opts: { confirmDuplicate?: boolean } = {}): Promise<string> {
  requirePermission(actor, "customers:write");
  requirePermission(actor, "leads:write");
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw notFound("That enquiry could not be found.");
  if (lead.customerId) throw validation("This enquiry is already linked to a customer.");
  if (!opts.confirmDuplicate) {
    const matches = await findCustomerMatches(db, lead.contactPhone, lead.contactEmail);
    if (matches.length) throw duplicateError(matches);
  }
  return withTx(async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({
        name: lead.contactName,
        phone: lead.contactPhone,
        phoneKey: lead.contactPhoneKey,
        email: lead.contactEmail,
        emailLower: lead.contactEmailLower,
        preferredContact: lead.preferredContact,
        createdBy: actor.id,
      })
      .returning({ id: customers.id });
    await tx.update(leads).set({ customerId: c!.id, possibleDuplicateCustomerId: null }).where(eq(leads.id, leadId));
    await tx.insert(leadActivities).values({ leadId, customerId: c!.id, type: "note", body: "Customer record created from this enquiry.", createdBy: actor.id });
    await recordAudit(tx, actor, { action: "customer.created_from_lead", entityType: "customer", entityId: c!.id, after: { leadId, name: lead.contactName } });
    return c!.id;
  });
}
