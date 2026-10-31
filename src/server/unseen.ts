import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

/** Cookie holding when the owner last opened a dashboard section, in milliseconds. Set in the browser by the menu (see AppNav). */
export const SEEN_COOKIE_PREFIX = "seen_";
export const SEEN_SECTIONS = { orders: "/app/orders", quotations: "/app/quotations", enquiries: "/app/enquiries", customers: "/app/customers" } as const;

export type SeenTimes = Record<keyof typeof SEEN_SECTIONS, number>;

/** Which sections have something that arrived after the owner last opened them (menu href → true). */
export async function getUnseen(seen: SeenTimes): Promise<Record<string, boolean>> {
  const at = (k: keyof SeenTimes) => sql`to_timestamp(${seen[k] / 1000})`;
  try {
    const [r] = (await getDb().execute(sql`
      SELECT
        EXISTS (SELECT 1 FROM online_orders WHERE created_at > ${at("orders")}) AS orders,
        EXISTS (SELECT 1 FROM messages WHERE kind = 'custom' AND created_at > ${at("quotations")}) AS quotations,
        EXISTS (SELECT 1 FROM messages WHERE kind <> 'custom' AND created_at > ${at("enquiries")}) AS enquiries,
        (
          EXISTS (SELECT 1 FROM customer_accounts WHERE created_at > ${at("customers")})
          OR EXISTS (
            SELECT 1 FROM (
              SELECT phone_key, created_at FROM online_orders
              UNION ALL SELECT phone_key, created_at FROM messages
            ) x GROUP BY phone_key HAVING min(created_at) > ${at("customers")}
          )
        ) AS customers
    `)) as unknown as [Record<keyof SeenTimes, boolean>];
    return Object.fromEntries((Object.keys(SEEN_SECTIONS) as (keyof SeenTimes)[]).map((k) => [SEEN_SECTIONS[k], Boolean(r?.[k])]));
  } catch {
    return {};
  }
}
