import "server-only";
import { sql } from "drizzle-orm";
import { can, requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { num, toCsv } from "@/lib/csv";
import { invalidState } from "@/lib/errors";
import { dec, moneyString } from "@/lib/money";
import { getBusinessSettings } from "@/lib/settings";
import { addDaysLocal, todayLocal } from "@/lib/time";

export interface DateRange {
  from: string;
  to: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const rows = <T>(r: unknown) => r as unknown as T[];

/** Validate and order a requested range; defaults to the last 30 days (business timezone). Ranges are inclusive and capped at 5 years. */
export async function resolveRange(from?: string, to?: string, now: Date = new Date()): Promise<DateRange & { timezone: string; currency: string }> {
  const b = await getBusinessSettings();
  const t = to && ISO.test(to) ? to : todayLocal(b.timezone, now);
  const f = from && ISO.test(from) ? from : addDaysLocal(-29, b.timezone, now);
  const [a, z] = f <= t ? [f, t] : [t, f];
  if (new Date(z).getTime() - new Date(a).getTime() > 5 * 366 * 86_400_000) throw invalidState("Choose a range of five years or less.");
  return { from: a, to: z, timezone: b.timezone, currency: b.currency };
}

/** Local calendar date of a timestamp column falls inside the range (inclusive). */
const inRange = (col: string, tz: string, r: DateRange) => sql`(${sql.raw(col)} AT TIME ZONE ${tz})::date BETWEEN ${r.from}::date AND ${r.to}::date`;

/* ───────────────────────────── sales ───────────────────────────── */

export const SALES_DEFINITIONS = [
  "Orders confirmed: orders confirmed in the period, leaving out any since cancelled. Value is the order total (including delivery charge).",
  "Orders delivered: orders marked delivered in the period.",
  "Cash received: money recorded as received in the period, net of reversals (a void reduces the day it was voided). It is not the same as sales value.",
  "Quotations accepted: accepted in the period, at their last revision's total. Quotations that were not accepted are never counted as sales.",
  "Invoiced: not available — this system does not issue invoices.",
  "Outstanding: total of confirmed orders minus net money received, right now.",
];

export async function getSalesReport(actor: Actor, range: DateRange) {
  const scope = requirePermission(actor, "reports:sales");
  const tz = (await getBusinessSettings()).timezone;
  const mine = scope === "own" ? sql`AND o.created_by = ${actor.id}` : sql``;
  const showMoneyIn = can(actor, "payments:view");
  const db = getDb();
  const [confirmed, delivered, cash, quotes, outstanding, byType] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS n, coalesce(sum(o.total), 0)::text AS value FROM sales_orders o WHERE o.confirmed_at IS NOT NULL AND o.status <> 'cancelled' AND ${inRange("o.confirmed_at", tz, range)} ${mine}`),
    db.execute(sql`SELECT count(*)::int AS n, coalesce(sum(o.total), 0)::text AS value FROM sales_orders o WHERE o.status = 'delivered' AND ${inRange("o.delivered_at", tz, range)} ${mine}`),
    showMoneyIn
      ? db.execute(sql`SELECT coalesce(sum(p.amount), 0)::text AS value, count(*)::int AS n FROM payments p JOIN sales_orders o ON o.id = p.order_id WHERE ${inRange("p.paid_at", tz, range)} ${mine}`)
      : Promise.resolve([{ value: null, n: 0 }]),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE q.sent_at IS NOT NULL AND ${inRange("q.sent_at", tz, range)})::int AS sent,
             count(*) FILTER (WHERE q.status IN ('accepted', 'converted') AND ${inRange("q.decided_at", tz, range)})::int AS accepted,
             coalesce(sum(r.total) FILTER (WHERE q.status IN ('accepted', 'converted') AND ${inRange("q.decided_at", tz, range)}), 0)::text AS accepted_value
      FROM quotations q JOIN quotation_revisions r ON r.quotation_id = q.id AND r.revision_no = q.current_revision_no
      ${scope === "own" ? sql`WHERE q.created_by = ${actor.id}` : sql``}`),
    showMoneyIn
      ? db.execute(sql`
          SELECT count(*)::int AS n, coalesce(sum(bal), 0)::text AS value FROM (
            SELECT o.total - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS bal
            FROM sales_orders o WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered') ${mine}) x WHERE bal > 0`)
      : Promise.resolve([{ n: 0, value: null }]),
    db.execute(sql`SELECT o.type::text AS type, count(*)::int AS n, coalesce(sum(o.total), 0)::text AS value FROM sales_orders o WHERE o.confirmed_at IS NOT NULL AND o.status <> 'cancelled' AND ${inRange("o.confirmed_at", tz, range)} ${mine} GROUP BY o.type`),
  ]);
  const c = rows<{ n: number; value: string }>(confirmed)[0]!;
  const d = rows<{ n: number; value: string }>(delivered)[0]!;
  const ca = rows<{ n: number; value: string | null }>(cash)[0]!;
  const q = rows<{ sent: number; accepted: number; accepted_value: string }>(quotes)[0]!;
  const o = rows<{ n: number; value: string | null }>(outstanding)[0]!;
  return {
    range,
    scope,
    confirmed: { count: c.n, value: moneyString(c.value) },
    delivered: { count: d.n, value: moneyString(d.value) },
    cashReceived: ca.value === null ? null : moneyString(ca.value),
    quotations: { sent: q.sent, accepted: q.accepted, acceptedValue: moneyString(q.accepted_value) },
    outstanding: o.value === null ? null : { count: o.n, value: moneyString(o.value) },
    byType: rows<{ type: string; n: number; value: string }>(byType).map((r) => ({ type: r.type, count: r.n, value: moneyString(r.value) })),
    definitions: SALES_DEFINITIONS,
  };
}

/* ───────────────────────────── financial ───────────────────────────── */

export const FINANCIAL_DEFINITIONS = [
  "Cash received: customer payments recorded in the period, net of reversals.",
  "Expenses: recorded, un-voided expenses dated in the period.",
  "Supplier payments: money paid against purchase orders in the period.",
  "Net cash movement = cash received − expenses − supplier payments. This is an OPERATIONAL view of money in and out. It is not profit, and it ignores stock, tax, depreciation and anything not recorded here.",
  "Owed by customers: confirmed orders' totals minus money received, right now.",
  "Owed to suppliers: for purchase orders with a recorded supplier invoice, invoice minus paid, right now. Orders with no invoice recorded are counted separately, not guessed.",
];

export async function getFinancialReport(actor: Actor, range: DateRange) {
  requirePermission(actor, "reports:financial");
  return computeFinancial(range);
}

async function computeFinancial(range: DateRange) {
  const tz = (await getBusinessSettings()).timezone;
  const db = getDb();
  const [cashIn, expenseRows, supplierPaid, receivable, payable, uninvoiced] = await Promise.all([
    db.execute(sql`SELECT coalesce(sum(p.amount), 0)::text AS value FROM payments p WHERE ${inRange("p.paid_at", tz, range)}`),
    db.execute(sql`SELECT c.name AS category, coalesce(sum(e.amount), 0)::text AS value, count(*)::int AS n FROM expenses e JOIN expense_categories c ON c.id = e.category_id WHERE e.voided_at IS NULL AND e.spent_on BETWEEN ${range.from}::date AND ${range.to}::date GROUP BY c.name ORDER BY sum(e.amount) DESC, c.name`),
    db.execute(sql`SELECT coalesce(sum(s.amount), 0)::text AS value FROM supplier_payments s WHERE ${inRange("s.paid_at", tz, range)}`),
    db.execute(sql`
      SELECT count(*)::int AS n, coalesce(sum(bal), 0)::text AS value FROM (
        SELECT o.total - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS bal
        FROM sales_orders o WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')) x WHERE bal > 0`),
    db.execute(sql`
      SELECT count(*)::int AS n, coalesce(sum(due), 0)::text AS value FROM (
        SELECT po.supplier_invoice_amount - coalesce((SELECT sum(s.amount) FROM supplier_payments s WHERE s.purchase_order_id = po.id), 0) AS due
        FROM purchase_orders po WHERE po.status <> 'cancelled' AND po.supplier_invoice_amount IS NOT NULL) x WHERE due > 0`),
    db.execute(sql`SELECT count(*)::int AS n FROM purchase_orders WHERE status IN ('sent', 'partially_received', 'received') AND supplier_invoice_amount IS NULL`),
  ]);
  const catRows = rows<{ category: string; value: string; n: number }>(expenseRows).map((r) => ({ category: r.category, total: moneyString(r.value), count: r.n }));
  const expensesTotal = catRows.reduce((s, r) => s.plus(r.total), dec(0));
  const inTotal = dec(rows<{ value: string }>(cashIn)[0]!.value);
  const outSupplier = dec(rows<{ value: string }>(supplierPaid)[0]!.value);
  const rcv = rows<{ n: number; value: string }>(receivable)[0]!;
  const pay = rows<{ n: number; value: string }>(payable)[0]!;
  return {
    range,
    cashReceived: moneyString(inTotal),
    expenses: moneyString(expensesTotal),
    expensesByCategory: catRows,
    supplierPayments: moneyString(outSupplier),
    netCashMovement: moneyString(inTotal.minus(expensesTotal).minus(outSupplier)),
    owedByCustomers: { count: rcv.n, value: moneyString(rcv.value) },
    owedToSuppliers: { count: pay.n, value: moneyString(pay.value), ordersWithoutInvoice: rows<{ n: number }>(uninvoiced)[0]!.n },
    definitions: FINANCIAL_DEFINITIONS,
  };
}

/* ───────────────────────────── operations ───────────────────────────── */

export const OPERATIONS_DEFINITIONS = [
  "Active jobs: custom jobs not yet ready for delivery or cancelled. Overdue = past the target date today.",
  "Jobs completed: jobs that reached 'Ready for delivery' in the period (a reopened job counts when it completes again).",
  "Stock value at cost: on-hand quantity × the item's standard cost, only for items that HAVE a cost. Items on hand without a cost are counted separately and left out — so it is a floor, not a valuation.",
  "Deliveries: by scheduled date in the period.",
];

export async function getOperationsReport(actor: Actor, range: DateRange, now: Date = new Date()) {
  const scope = requirePermission(actor, "reports:operations");
  const b = await getBusinessSettings();
  const today = todayLocal(b.timezone, now);
  const tz = b.timezone;
  const db = getDb();
  const own = scope === "own";
  const jobScope = own ? sql`AND EXISTS (SELECT 1 FROM production_job_assignees a WHERE a.job_id = j.id AND a.user_id = ${actor.id})` : sql``;
  const delScope = own ? sql`AND d.assignee_id = ${actor.id}` : sql``;
  const showStock = can(actor, "inventory:view") || can(actor, "inventory:view_materials");
  const showCostValue = can(actor, "production:view_costs");
  const [jobsByStage, completed, deliveriesByStatus, openPOs, stock, cases] = await Promise.all([
    db.execute(sql`SELECT j.stage::text AS stage, count(*)::int AS n, count(*) FILTER (WHERE j.target_date < ${today}::date)::int AS overdue FROM production_jobs j WHERE j.stage NOT IN ('ready_for_delivery', 'cancelled') ${jobScope} GROUP BY j.stage`),
    db.execute(sql`SELECT count(*)::int AS n FROM production_jobs j WHERE j.completed_at IS NOT NULL AND ${inRange("j.completed_at", tz, range)} ${jobScope}`),
    db.execute(sql`SELECT d.status::text AS status, count(*)::int AS n FROM deliveries d WHERE d.scheduled_on BETWEEN ${range.from}::date AND ${range.to}::date ${delScope} GROUP BY d.status`),
    can(actor, "purchasing:view") ? db.execute(sql`SELECT count(*)::int AS n FROM purchase_orders WHERE status IN ('sent', 'partially_received')`) : Promise.resolve([{ n: null }]),
    showStock
      ? db.execute(sql`
          SELECT coalesce(sum(b.on_hand * i.cost_price) FILTER (WHERE i.cost_price IS NOT NULL), 0)::text AS value,
                 count(DISTINCT i.id) FILTER (WHERE i.cost_price IS NULL AND b.on_hand > 0)::int AS uncosted,
                 count(DISTINCT i.id) FILTER (WHERE b.low_stock_threshold IS NOT NULL AND (b.on_hand - b.reserved) <= b.low_stock_threshold)::int AS low
          FROM inventory_balances b JOIN inventory_items i ON i.id = b.item_id WHERE i.archived_at IS NULL`)
      : Promise.resolve([{ value: null, uncosted: 0, low: 0 }]),
    can(actor, "aftersales:view") ? db.execute(sql`SELECT count(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS open, count(*) FILTER (WHERE status IN ('open', 'in_progress') AND due_on < ${today}::date)::int AS overdue FROM after_sales_cases`) : Promise.resolve([{ open: null, overdue: null }]),
  ]);
  const stages: Record<string, number> = {};
  let overdue = 0;
  for (const r of rows<{ stage: string; n: number; overdue: number }>(jobsByStage)) {
    stages[r.stage] = r.n;
    overdue += r.overdue;
  }
  const st = rows<{ value: string | null; uncosted: number; low: number }>(stock)[0]!;
  const cs = rows<{ open: number | null; overdue: number | null }>(cases)[0]!;
  const deliv: Record<string, number> = {};
  for (const r of rows<{ status: string; n: number }>(deliveriesByStatus)) deliv[r.status] = r.n;
  return {
    range,
    scope,
    jobs: { active: Object.values(stages).reduce((s, n) => s + n, 0), overdue, byStage: stages, completedInRange: rows<{ n: number }>(completed)[0]!.n },
    deliveries: deliv,
    openPurchaseOrders: rows<{ n: number | null }>(openPOs)[0]!.n,
    stock: showStock ? { lowStockLines: st.low, valueAtCost: showCostValue && st.value !== null ? moneyString(st.value) : null, itemsWithoutCost: showCostValue ? st.uncosted : null } : null,
    afterSales: cs.open === null ? null : { open: cs.open, overdue: cs.overdue },
    definitions: OPERATIONS_DEFINITIONS,
  };
}

/* ───────────────────────────── owner dashboard ───────────────────────────── */

export async function getOwnerDashboard(actor: Actor, range: DateRange, now: Date = new Date()) {
  requirePermission(actor, "dashboard:owner");
  const tz = (await getBusinessSettings()).timezone;
  const today = todayLocal(tz, now);
  const db = getDb();
  const [fin, sales, ops, todays] = await Promise.all([
    computeFinancial(range),
    getSalesReport(actor, range),
    getOperationsReport(actor, range, now),
    db.execute(sql`SELECT count(*)::int AS n FROM deliveries WHERE scheduled_on = ${today}::date AND status IN ('planned', 'out_for_delivery')`),
  ]);
  return { range, fin, sales, ops, deliveriesToday: rows<{ n: number }>(todays)[0]!.n };
}

/* ───────────────────────────── CSV exports ───────────────────────────── */

export const EXPORTS = ["orders", "payments", "expenses", "stock", "jobs"] as const;
export type ExportKind = (typeof EXPORTS)[number];

/** Each export checks its own permission; the same data a person can see on screen, nothing more. */
export async function exportCsv(actor: Actor, kind: ExportKind, range: DateRange): Promise<{ filename: string; csv: string }> {
  const b = await getBusinessSettings();
  const tz = b.timezone;
  const db = getDb();
  const name = (s: string) => `${s}_${range.from}_to_${range.to}.csv`;
  switch (kind) {
    case "orders": {
      const scope = requirePermission(actor, "reports:sales");
      const r = rows<Record<string, string | null>>(
        await db.execute(sql`
          SELECT o.reference, o.type::text AS type, o.status::text AS status, c.name AS customer, o.currency, o.subtotal::text, o.discount_total::text, o.delivery_charge::text, o.total::text,
                 coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0)::text AS paid,
                 to_char(o.confirmed_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS confirmed_on, to_char(o.delivered_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS delivered_on
          FROM sales_orders o JOIN customers c ON c.id = o.customer_id
          WHERE ${inRange("o.created_at", tz, range)} ${scope === "own" ? sql`AND o.created_by = ${actor.id}` : sql``}
          ORDER BY o.created_at`),
      );
      const showPaid = can(actor, "payments:view");
      return { filename: name("orders"), csv: toCsv(["Reference", "Type", "Status", "Customer", "Currency", "Subtotal", "Discounts", "Delivery charge", "Total", ...(showPaid ? ["Received"] : []), "Confirmed on", "Delivered on"], r.map((x) => [x.reference, x.type, x.status, x.customer, x.currency, num(x.subtotal), num(x.discount_total), num(x.delivery_charge), num(x.total), ...(showPaid ? [num(x.paid)] : []), x.confirmed_on, x.delivered_on])) };
    }
    case "payments": {
      requirePermission(actor, "reports:financial");
      const r = rows<Record<string, string | null>>(
        await db.execute(sql`
          SELECT to_char(p.paid_at AT TIME ZONE ${tz}, 'YYYY-MM-DD HH24:MI') AS paid_at, o.reference AS order_ref, c.name AS customer, p.method::text AS method, p.amount::text AS amount, p.reference, CASE WHEN p.voids_payment_id IS NOT NULL THEN 'reversal' ELSE '' END AS kind
          FROM payments p JOIN sales_orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id
          WHERE ${inRange("p.paid_at", tz, range)} ORDER BY p.paid_at`),
      );
      return { filename: name("payments"), csv: toCsv(["Paid at", "Order", "Customer", "Method", "Amount", "Reference", "Note"], r.map((x) => [x.paid_at, x.order_ref, x.customer, x.method, num(x.amount), x.reference, x.kind])) };
    }
    case "expenses": {
      requirePermission(actor, "expenses:view");
      const r = rows<Record<string, string | null>>(
        await db.execute(sql`
          SELECT to_char(e.spent_on, 'YYYY-MM-DD') AS spent_on, c.name AS category, e.description, e.payee, e.method::text AS method, e.amount::text AS amount, e.reference, CASE WHEN e.voided_at IS NOT NULL THEN 'VOID: ' || e.void_reason ELSE '' END AS status
          FROM expenses e JOIN expense_categories c ON c.id = e.category_id
          WHERE e.spent_on BETWEEN ${range.from}::date AND ${range.to}::date ORDER BY e.spent_on, e.created_at`),
      );
      return { filename: name("expenses"), csv: toCsv(["Date", "Category", "Description", "Payee", "Method", "Amount", "Reference", "Status"], r.map((x) => [x.spent_on, x.category, x.description, x.payee, x.method, num(x.amount), x.reference, x.status])) };
    }
    case "stock": {
      if (!can(actor, "inventory:view") && !can(actor, "inventory:view_materials")) requirePermission(actor, "inventory:view");
      const kinds = can(actor, "inventory:view") ? ["finished_good", "raw_material", "consumable"] : ["raw_material", "consumable"];
      const showCost = can(actor, "production:view_costs");
      const r = rows<Record<string, string | null>>(
        await db.execute(sql`
          SELECT i.sku, i.name, i.kind::text AS kind, i.unit, l.name AS location, b.on_hand::text AS on_hand, b.reserved::text AS reserved, (b.on_hand - b.reserved)::text AS available, i.cost_price::text AS cost
          FROM inventory_balances b JOIN inventory_items i ON i.id = b.item_id JOIN locations l ON l.id = b.location_id
          WHERE i.archived_at IS NULL AND i.kind::text = ANY(${sql.raw(`ARRAY[${kinds.map((k) => `'${k}'`).join(",")}]`)}) ORDER BY i.name, l.name`),
      );
      return { filename: `stock_${todayLocal(tz)}.csv`, csv: toCsv(["SKU", "Name", "Type", "Unit", "Location", "On hand", "Reserved", "Available", ...(showCost ? ["Standard cost"] : [])], r.map((x) => [x.sku, x.name, x.kind, x.unit, x.location, num(x.on_hand), num(x.reserved), num(x.available), ...(showCost ? [num(x.cost)] : [])])) };
    }
    case "jobs": {
      const scope = requirePermission(actor, "reports:operations");
      const own = scope === "own" ? sql`AND EXISTS (SELECT 1 FROM production_job_assignees a WHERE a.job_id = j.id AND a.user_id = ${actor.id})` : sql``;
      const r = rows<Record<string, string | null>>(
        await db.execute(sql`
          SELECT j.reference, j.description, j.stage::text AS stage, j.priority::text AS priority, to_char(j.target_date, 'YYYY-MM-DD') AS target, to_char(j.completed_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS completed,
                 (SELECT string_agg(p.full_name, '; ' ORDER BY p.full_name) FROM production_job_assignees a JOIN profiles p ON p.id = a.user_id WHERE a.job_id = j.id) AS assignees
          FROM production_jobs j WHERE ${inRange("j.created_at", tz, range)} ${own} ORDER BY j.created_at`),
      );
      return { filename: name("jobs"), csv: toCsv(["Job", "Description", "Stage", "Priority", "Target date", "Completed", "Assigned to"], r.map((x) => [x.reference, x.description, x.stage, x.priority, x.target, x.completed, x.assignees])) };
    }
  }
}

