import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { listUsers, setUserActive, setUserRoles } from "@/server/users";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

describe.skipIf(!hasTestDb)("user management (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, owner2: Actor, manager: Actor, sales: Actor;

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    manager = await makeActor(t, ["manager"], "Mia Manager");
    sales = await makeActor(t, ["sales"], "Sam Sales");
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("only the owner may list or change users", async () => {
    for (const a of [manager, sales]) {
      await expect(listUsers(a)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(setUserRoles(a, sales.id, ["owner"])).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(setUserActive(a, sales.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    const users = await listUsers(owner);
    expect(users.find((u) => u.id === sales.id)).toMatchObject({ roles: ["sales"], isActive: true });
  });

  it("changes roles as a union, audits the change, and takes effect on the next request", async () => {
    await setUserRoles(owner, sales.id, ["sales", "finance"]);
    expect((await listUsers(owner)).find((u) => u.id === sales.id)!.roles.sort()).toEqual(["finance", "sales"]);
    const [log] = await t.sql`SELECT before, after FROM audit_logs WHERE action = 'user.roles_changed' AND entity_id = ${sales.id} ORDER BY created_at DESC LIMIT 1`;
    expect(log).toMatchObject({ before: { roles: ["sales"] }, after: { roles: ["sales", "finance"] } });
    await setUserRoles(owner, sales.id, ["sales"]);
    await expect(setUserRoles(owner, sales.id, [])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setUserRoles(owner, sales.id, ["superuser"])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setUserRoles(owner, "00000000-0000-4000-8000-000000000001", ["sales"])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("can never leave the business without an active owner", async () => {
    await expect(setUserRoles(owner, owner.id, ["manager"])).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(setUserActive(owner, owner.id, false)).rejects.toMatchObject({ code: "INVALID_STATE" });
    owner2 = await makeActor(t, ["owner"], "Omar Owner");
    // two owners trying to demote each other at once: exactly one succeeds
    const results = await Promise.allSettled([setUserRoles(owner, owner2.id, ["manager"]), setUserRoles(owner2, owner.id, ["manager"])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const owners = (await listUsers(owner)).filter((u) => u.roles.includes("owner") && u.isActive);
    expect(owners).toHaveLength(1);
  });

  it("deactivation and reactivation are audited and flip the stored flag; owners cannot deactivate themselves", async () => {
    const survivor = (await t.sql`SELECT user_id FROM user_roles WHERE role = 'owner'`)[0]!.user_id as string;
    const boss = [owner, owner2].find((a) => a.id === survivor)!;
    await setUserActive(boss, sales.id, false);
    expect((await t.sql`SELECT is_active FROM profiles WHERE id = ${sales.id}`)[0]!.is_active).toBe(false);
    // an actor built from the now-inactive profile has no permissions at all
    const asInactive: Actor = { ...sales, isActive: false };
    await expect(listUsers(asInactive)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setUserActive(boss, sales.id, true);
    expect((await t.sql`SELECT is_active FROM profiles WHERE id = ${sales.id}`)[0]!.is_active).toBe(true);
    const actions = (await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${sales.id} AND action LIKE 'user.%activated'`).map((r) => r.action).sort();
    expect(actions).toEqual(["user.deactivated", "user.reactivated"]);
    await expect(setUserActive(boss, boss.id, false)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
