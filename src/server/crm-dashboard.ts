import "server-only";
import { sql } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { getBusinessSettings } from "@/lib/settings";
import { todayLocal } from "@/lib/time";

export interface SalesDashboard {
  range: { from: string; to: string };
  today: string;
  leads: { new: number; unassignedOpen: number; open: number; byStatus: Record<string, number> };
  followUps: { overdueMine: number; overdueAll: number; dueTodayMine: number };
  quotations: { awaitingCount: number; awaitingValue: string; pastValidityCount: number };
  /** Metrics are counts only: quotation values are NEVER treated as revenue. */
  conversion: { created: number; won: number; lost: number; rate: number | null };
}

/**
 * Definitions (shown on the dashboard):
 *  - Conversion rate = won ÷ (won + lost) among enquiries CLOSED in the date range; null when none closed.
 *  - "Awaiting response" = quotations currently Sent; their value is exposure, not revenue.
 *  - Dates use the business timezone.
 */
export async function getSalesDashboard(actor: Actor, range: { from: string; to: string }, now: Date = new Date()): Promise<SalesDashboard> {
  requirePermission(actor, "dashboard:sales");
  const tz = (await getBusinessSettings()).timezone;
  const today = todayLocal(tz, now);
  const db = getDb();
  const rows = <T>(r: unknown) => r as unknown as T[];

  const [byStatus, fu, qt, conv] = await Promise.all([
    db.execute(sql`SELECT status::text AS status, count(*)::int AS n, count(*) FILTER (WHERE assigned_to IS NULL)::int AS unassigned FROM leads GROUP BY status`),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE assigned_to = ${actor.id} AND due_on < ${today})::int AS overdue_mine,
        count(*) FILTER (WHERE due_on < ${today})::int AS overdue_all,
        count(*) FILTER (WHERE assigned_to = ${actor.id} AND due_on = ${today})::int AS due_today_mine
      FROM follow_up_tasks WHERE completed_at IS NULL`),
    db.execute(sql`
      SELECT count(*)::int AS n, coalesce(sum(r.total), 0)::text AS value,
             count(*) FILTER (WHERE r.valid_until < ${today})::int AS past
      FROM quotations q JOIN quotation_revisions r ON r.quotation_id = q.id AND r.revision_no = q.current_revision_no
      WHERE q.status = 'sent'`),
    db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM leads WHERE (created_at AT TIME ZONE ${tz})::date BETWEEN ${range.from} AND ${range.to}) AS created,
        (SELECT count(*)::int FROM leads WHERE status = 'won' AND (closed_at AT TIME ZONE ${tz})::date BETWEEN ${range.from} AND ${range.to}) AS won,
        (SELECT count(*)::int FROM leads WHERE status = 'lost' AND (closed_at AT TIME ZONE ${tz})::date BETWEEN ${range.from} AND ${range.to}) AS lost`),
  ]);

  const statusRows = rows<{ status: string; n: number; unassigned: number }>(byStatus);
  const map: Record<string, number> = {};
  for (const r of statusRows) map[r.status] = r.n;
  const OPEN = ["new", "contacted", "requirements_confirmed", "quotation_sent", "negotiation"];
  const f = rows<{ overdue_mine: number; overdue_all: number; due_today_mine: number }>(fu)[0]!;
  const q = rows<{ n: number; value: string; past: number }>(qt)[0]!;
  const c = rows<{ created: number; won: number; lost: number }>(conv)[0]!;
  return {
    range,
    today,
    leads: {
      new: map.new ?? 0,
      open: OPEN.reduce((s, k) => s + (map[k] ?? 0), 0),
      unassignedOpen: statusRows.filter((r) => OPEN.includes(r.status)).reduce((s, r) => s + r.unassigned, 0),
      byStatus: map,
    },
    followUps: { overdueMine: f.overdue_mine, overdueAll: f.overdue_all, dueTodayMine: f.due_today_mine },
    quotations: { awaitingCount: q.n, awaitingValue: q.value, pastValidityCount: q.past },
    conversion: { created: c.created, won: c.won, lost: c.lost, rate: c.won + c.lost === 0 ? null : c.won / (c.won + c.lost) },
  };
}
