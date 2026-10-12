import "server-only";
import { outer } from "@/lib/db/outer";
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, withTx } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { expenseCategories, expenses, profiles, uploadedFiles } from "@/lib/db/schema";
import { conflict, invalidState, notFound, validation } from "@/lib/errors";
import { dec, moneyString } from "@/lib/money";
import { recordAudit } from "./audit";
import { linkUploads, verifyUploads } from "./files";
import { escapeLike } from "./leads";

export type ExpenseMethod = (typeof expenses.$inferSelect)["method"];

export interface ExpenseInput {
  spentOn: string;
  categoryId: string;
  amount: string;
  description: string;
  payee?: string;
  method: ExpenseMethod;
  reference?: string;
  fileIds?: string[];
}

const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/* ───────────────────────────── categories ───────────────────────────── */

export async function listExpenseCategories(actor: Actor, includeInactive = false) {
  requirePermission(actor, "expenses:view");
  return getDb()
    .select()
    .from(expenseCategories)
    .where(includeInactive ? undefined : eq(expenseCategories.isActive, true))
    .orderBy(asc(expenseCategories.name));
}

export async function saveExpenseCategory(actor: Actor, input: { id?: string; name: string; isActive: boolean }): Promise<string> {
  requirePermission(actor, "expenses:manage_categories");
  const name = input.name.trim();
  if (!name) throw validation("Enter a category name.", { name: ["Enter a category name."] });
  try {
    return await withTx(async (tx) => {
      if (input.id) {
        const res = await tx.update(expenseCategories).set({ name, isActive: input.isActive }).where(eq(expenseCategories.id, input.id)).returning({ id: expenseCategories.id });
        if (!res.length) throw notFound("That category could not be found.");
        await recordAudit(tx, actor, { action: "expense_category.updated", entityType: "expense_category", entityId: input.id, after: { name, isActive: input.isActive } });
        return input.id;
      }
      const [c] = await tx.insert(expenseCategories).values({ name }).returning({ id: expenseCategories.id });
      await recordAudit(tx, actor, { action: "expense_category.created", entityType: "expense_category", entityId: c!.id, after: { name } });
      return c!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("A category with that name already exists.");
    throw e;
  }
}

/* ───────────────────────────── expenses ───────────────────────────── */

export async function createExpense(actor: Actor, input: ExpenseInput): Promise<string> {
  requirePermission(actor, "expenses:write");
  const amount = dec(input.amount);
  if (!amount.gt(0)) throw validation("Enter an amount greater than zero.", { amount: ["Enter an amount greater than zero."] });
  const description = input.description.trim();
  if (!description) throw validation("Say what the money was spent on.", { description: ["Say what the money was spent on."] });
  const verified = await verifyUploads(input.fileIds ?? [], "expense", actor);
  return withTx(async (tx) => {
    const [cat] = await tx.select({ id: expenseCategories.id, isActive: expenseCategories.isActive }).from(expenseCategories).where(eq(expenseCategories.id, input.categoryId));
    if (!cat || !cat.isActive) throw validation("Choose an active category.", { categoryId: ["Choose an active category."] });
    const [e] = await tx
      .insert(expenses)
      .values({ spentOn: input.spentOn, categoryId: input.categoryId, amount: moneyString(amount), description, payee: blank(input.payee), method: input.method, reference: blank(input.reference), createdBy: actor.id })
      .returning({ id: expenses.id });
    await linkUploads(tx, verified, { type: "expense", id: e!.id });
    await recordAudit(tx, actor, { action: "expense.created", entityType: "expense", entityId: e!.id, after: { amount: moneyString(amount), category: input.categoryId, spentOn: input.spentOn, attachments: verified.length } });
    return e!.id;
  });
}

/** Expenses are never edited or deleted. Voiding keeps the row, records who and why, and removes it from every total. */
export async function voidExpense(actor: Actor, id: string, reason: string): Promise<void> {
  requirePermission(actor, "expenses:void");
  const why = reason.trim();
  if (!why) throw validation("Say why this expense is being voided.", { reason: ["Add a short reason."] });
  await withTx(async (tx) => {
    const [e] = await tx.select().from(expenses).where(eq(expenses.id, id)).for("update");
    if (!e) throw notFound("That expense could not be found.");
    if (e.voidedAt) throw invalidState("This expense has already been voided.");
    await tx.update(expenses).set({ voidedAt: new Date(), voidedBy: actor.id, voidReason: why }).where(eq(expenses.id, id));
    await recordAudit(tx, actor, { action: "expense.voided", entityType: "expense", entityId: id, before: { amount: e.amount, description: e.description }, reason: why });
  });
}

export interface ExpenseFilters {
  from?: string;
  to?: string;
  categoryId?: string;
  q?: string;
  includeVoided?: boolean;
  page: number;
  pageSize: number;
}

export async function listExpenses(actor: Actor, f: ExpenseFilters) {
  requirePermission(actor, "expenses:view");
  const where: SQL[] = [];
  if (!f.includeVoided) where.push(isNull(expenses.voidedAt));
  if (f.from) where.push(gte(expenses.spentOn, f.from));
  if (f.to) where.push(lte(expenses.spentOn, f.to));
  if (f.categoryId) where.push(eq(expenses.categoryId, f.categoryId));
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(expenses.description, like), ilike(expenses.payee, like), ilike(expenses.reference, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [rows, [agg]] = await Promise.all([
    db
      .select({
        id: expenses.id,
        spentOn: expenses.spentOn,
        amount: expenses.amount,
        description: expenses.description,
        payee: expenses.payee,
        method: expenses.method,
        reference: expenses.reference,
        voidedAt: expenses.voidedAt,
        voidReason: expenses.voidReason,
        categoryName: expenseCategories.name,
        byName: profiles.fullName,
        files: sql<number>`(SELECT count(*)::int FROM uploaded_files f WHERE f.entity_type = 'expense' AND f.entity_id = ${outer(expenses.id)}::text AND f.status = 'linked')`,
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .leftJoin(profiles, eq(profiles.id, expenses.createdBy))
      .where(cond)
      .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db
      .select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${expenses.amount}) FILTER (WHERE ${expenses.voidedAt} IS NULL), 0)::text` })
      .from(expenses)
      .where(cond),
  ]);
  const n = agg?.n ?? 0;
  return { rows, total: n, totalAmount: moneyString(agg?.total ?? "0"), pageCount: Math.max(1, Math.ceil(n / f.pageSize)) };
}

export async function getExpenseFiles(actor: Actor, expenseId: string) {
  requirePermission(actor, "expenses:view");
  return getDb()
    .select({ id: uploadedFiles.id, name: uploadedFiles.originalName })
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.entityType, "expense"), eq(uploadedFiles.entityId, expenseId), eq(uploadedFiles.status, "linked")));
}
