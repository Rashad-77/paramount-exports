import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { auditLogs } from "@/lib/db/schema";
import { recordAudit } from "@/server/audit";
import { createTestDb, hasTestDb, type TestDb } from "../helpers/db";

describe.skipIf(!hasTestDb)("audit recording (real Postgres)", () => {
  let t: TestDb;
  let actor: Actor;

  beforeAll(async () => {
    t = await createTestDb();
    const [u] = await t.sql`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'o@example.test') RETURNING id`;
    await t.sql`INSERT INTO profiles (id, full_name) VALUES (${u!.id}, 'Audit Owner')`;
    actor = { id: u!.id as string, fullName: "Audit Owner", roles: ["owner"], isActive: true };
  });
  afterAll(async () => {
    await t?.close();
  });

  it("stores who did what, with before/after and reason", async () => {
    await recordAudit(t.db, actor, {
      action: "inventory.adjust",
      entityType: "inventory_balance",
      entityId: "abc",
      before: { onHand: "10.000" },
      after: { onHand: "8.000" },
      reason: "Damaged in handling",
    });
    const [row] = await t.db.select().from(auditLogs).where(sql`${auditLogs.action} = 'inventory.adjust'`);
    expect(row).toMatchObject({ actorId: actor.id, entityType: "inventory_balance", reason: "Damaged in handling" });
    expect(row!.before).toEqual({ onHand: "10.000" });
    expect(row!.after).toEqual({ onHand: "8.000" });
  });

  it("rolls back with the business change when the transaction fails", async () => {
    await expect(
      t.db.transaction(async (tx) => {
        await recordAudit(tx, actor, { action: "payment.void", entityType: "payment", entityId: "p1" });
        throw new Error("simulated failure after audit write");
      }),
    ).rejects.toThrow(/simulated failure/);
    const rows = await t.db.select().from(auditLogs).where(sql`${auditLogs.action} = 'payment.void'`);
    expect(rows).toHaveLength(0);
  });
});
