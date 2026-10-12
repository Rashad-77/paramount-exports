import "server-only";
import { sql } from "drizzle-orm";
import { can, scopeOf, type Actor } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal, addDaysLocal } from "@/lib/time";

export interface DashboardCharts {
  /** Every local calendar day in the range, oldest first (at most 92). */
  days: string[];
  /** Each series has one value per day; null when this person may not see it. */
  enquiries: number[] | null;
  orderCount: number[] | null;
  orderValue: number[] | null;
  cash: number[] | null;
  expenses: number[] | null;
  expenseByCategory: { label: string; value: number }[] | null;
  ordersByStatus: { label: string; n: number }[] | null;
  receivables: { id: string; reference: string; customer: string; balance: number; daysOpen: number }[] | null;
  upcomingDeliveries: { id: string; reference: string; contact: string; on: string; status: string }[] | null;
}

const MAX_DAYS = 92;
const rows = <T>(r: unknown) => r as unknown as T[];

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`); d <= end && out.length < MAX_DAYS; d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
}

/** The dashboard's time series and breakdowns. Each block is only computed for people allowed to see it. */
export async function getDashboardCharts(actor: Actor, range: { from: string; to: string }): Promise<DashboardCharts> {
  const tz = (await getBusinessSettings()).timezone;
  const db = getDb();
  const days = eachDay(range.from, range.to);
  // Only the most recent MAX_DAYS days are charted when a longer range is chosen.
  const from = days[0]!;
  const to = days[days.length - 1]!;
  const local = (col: string) => sql`(${sql.raw(col)} AT TIME ZONE ${tz})::date`;
  const between = (expr: ReturnType<typeof local>) => sql`${expr} BETWEEN ${from}::date AND ${to}::date`;
  const perDay = <T extends { d: string }>(r: T[], pick: (x: T) => number) => {
    const m = new Map(r.map((x) => [x.d, pick(x)]));
    return days.map((d) => m.get(d) ?? 0);
  };

  const sales = can(actor, "dashboard:sales");
  const owner = can(actor, "dashboard:owner");
  const finance = owner || can(actor, "dashboard:finance");
  const today = todayLocal(tz);

  const [enq, ord, cash, exp, cat, status, rec, del] = await Promise.all([
    sales ? db.execute(sql`SELECT to_char(${local("created_at")}, 'YYYY-MM-DD') AS d, count(*)::int AS n FROM leads WHERE ${between(local("created_at"))} GROUP BY 1`) : null,
    owner ? db.execute(sql`SELECT to_char(${local("confirmed_at")}, 'YYYY-MM-DD') AS d, count(*)::int AS n, coalesce(sum(total), 0)::float8 AS v FROM sales_orders WHERE confirmed_at IS NOT NULL AND status <> 'cancelled' AND ${between(local("confirmed_at"))} GROUP BY 1`) : null,
    finance ? db.execute(sql`SELECT to_char(${local("paid_at")}, 'YYYY-MM-DD') AS d, coalesce(sum(amount), 0)::float8 AS v FROM payments WHERE ${between(local("paid_at"))} GROUP BY 1`) : null,
    finance ? db.execute(sql`SELECT to_char(spent_on, 'YYYY-MM-DD') AS d, coalesce(sum(amount), 0)::float8 AS v FROM expenses WHERE voided_at IS NULL AND spent_on BETWEEN ${from}::date AND ${to}::date GROUP BY 1`) : null,
    finance ? db.execute(sql`SELECT c.name AS label, coalesce(sum(e.amount), 0)::float8 AS v FROM expenses e JOIN expense_categories c ON c.id = e.category_id WHERE e.voided_at IS NULL AND e.spent_on BETWEEN ${from}::date AND ${to}::date GROUP BY c.name ORDER BY sum(e.amount) DESC, c.name`) : null,
    finance ? db.execute(sql`SELECT status::text AS s, count(*)::int AS n FROM sales_orders WHERE status IN ('confirmed', 'preparing', 'ready', 'delivered') GROUP BY status`) : null,
    finance
      ? db.execute(sql`
          SELECT o.id::text AS id, o.reference, c.name AS customer, (o.total - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0))::float8 AS bal,
                 greatest(0, (${today}::date - (o.confirmed_at AT TIME ZONE ${tz})::date))::int AS days_open
          FROM sales_orders o JOIN customers c ON c.id = o.customer_id
          WHERE o.status IN ('confirmed', 'preparing', 'ready', 'delivered')
            AND o.total - coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id = o.id), 0) > 0
          ORDER BY bal DESC LIMIT 5`)
      : null,
    can(actor, "deliveries:view")
      ? db.execute(sql`SELECT id::text AS id, reference, contact_name AS contact, to_char(scheduled_on, 'YYYY-MM-DD') AS "on", status::text AS status FROM deliveries WHERE status IN ('planned', 'out_for_delivery') AND scheduled_on BETWEEN ${today}::date AND ${addDaysLocal(7, tz)}::date ${scopeOf(actor, "deliveries:view") === "all" ? sql`` : sql`AND assignee_id = ${actor.id}`} ORDER BY scheduled_on, reference LIMIT 6`)
      : null,
  ]);

  const STATUS_LABEL: Record<string, string> = { confirmed: "Confirmed", preparing: "In preparation", ready: "Ready", delivered: "Delivered" };
  const catRows = cat ? rows<{ label: string; v: number }>(cat) : null;
  let byCategory: { label: string; value: number }[] | null = null;
  if (catRows) {
    const top = catRows.slice(0, 4).map((r) => ({ label: r.label, value: r.v }));
    const rest = catRows.slice(4).reduce((s, r) => s + r.v, 0);
    byCategory = rest > 0 ? [...top, { label: "Other", value: rest }] : top;
  }

  return {
    days,
    enquiries: enq ? perDay(rows<{ d: string; n: number }>(enq), (x) => x.n) : null,
    orderCount: ord ? perDay(rows<{ d: string; n: number }>(ord), (x) => x.n) : null,
    orderValue: ord ? perDay(rows<{ d: string; v: number }>(ord), (x) => x.v) : null,
    cash: cash ? perDay(rows<{ d: string; v: number }>(cash), (x) => x.v) : null,
    expenses: exp ? perDay(rows<{ d: string; v: number }>(exp), (x) => x.v) : null,
    expenseByCategory: byCategory,
    ordersByStatus: status ? ["confirmed", "preparing", "ready", "delivered"].map((k) => ({ label: STATUS_LABEL[k]!, n: rows<{ s: string; n: number }>(status).find((r) => r.s === k)?.n ?? 0 })) : null,
    receivables: rec ? rows<{ id: string; reference: string; customer: string; bal: number; days_open: number }>(rec).map((r) => ({ id: r.id, reference: r.reference, customer: r.customer, balance: r.bal, daysOpen: r.days_open })) : null,
    upcomingDeliveries: del ? rows<{ id: string; reference: string; contact: string; on: string; status: string }>(del) : null,
  };
}
