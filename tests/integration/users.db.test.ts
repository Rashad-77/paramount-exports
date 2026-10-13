import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/permissions";
import { listUsers, setUserActive, setUserRoles } from "@/server/users";
import { hasTestDb } from "../helpers/db";
import { makeActor, setupApp } from "../helpers/app";

describe.skipIf(!hasTestDb)("user management (real Postgres)", () => {
  let t: Awaited<ReturnType<typeof setupApp>>;
  let owner: Actor, owner2: Actor, staff: Actor, staff2: Actor;

  beforeAll(async () => {
    t = await setupApp();
    owner = await makeActor(t, ["owner"], "Olivia Owner");
    staff = await makeActor(t, ["staff"], "Mia Staff");
    staff2 = await makeActor(t, ["staff"], "Sam Staff");
  });
  afterAll(async () => {
    await t?.teardown();
  });

  it("only the owner may list or change users", async () => {
    for (const a of [staff, staff2]) {
      await expect(listUsers(a)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(setUserRoles(a, staff2.id, ["owner"])).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(setUserActive(a, staff2.id, false)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    const users = await listUsers(owner);
    expect(users.find((u) => u.id === staff2.id)).toMatchObject({ roles: ["staff"], isActive: true });
  });

  it("changes roles as a union, audits the change, and takes effect on the next request", async () => {
    await setUserRoles(owner, staff2.id, ["staff", "owner"]);
    expect((await listUsers(owner)).find((u) => u.id === staff2.id)!.roles.sort()).toEqual(["owner", "staff"]);
    const [log] = await t.sql`SELECT before, after FROM audit_logs WHERE action = 'user.roles_changed' AND entity_id = ${staff2.id} ORDER BY created_at DESC LIMIT 1`;
    expect(log).toMatchObject({ before: { roles: ["staff"] }, after: { roles: ["staff", "owner"] } });
    await setUserRoles(owner, staff2.id, ["staff"]);
    await expect(setUserRoles(owner, staff2.id, [])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setUserRoles(owner, staff2.id, ["superuser"])).rejects.toMatchObject({ code: "VALIDATION" });
    // the roles retired with the CRM and ERP can no longer be given
    await expect(setUserRoles(owner, staff2.id, ["manager"])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setUserRoles(owner, "00000000-0000-4000-8000-000000000001", ["staff"])).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("can never leave the business without an active owner", async () => {
    await expect(setUserRoles(owner, owner.id, ["staff"])).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(setUserActive(owner, owner.id, false)).rejects.toMatchObject({ code: "INVALID_STATE" });
    owner2 = await makeActor(t, ["owner"], "Omar Owner");
    // two owners trying to demote each other at once: exactly one succeeds
    const results = await Promise.allSettled([setUserRoles(owner, owner2.id, ["staff"]), setUserRoles(owner2, owner.id, ["staff"])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const owners = (await listUsers(owner)).filter((u) => u.roles.includes("owner") && u.isActive);
    expect(owners).toHaveLength(1);
  });

  it("deactivation and reactivation are audited and flip the stored flag; owners cannot deactivate themselves", async () => {
    const survivor = (await t.sql`SELECT user_id FROM user_roles WHERE role = 'owner'`)[0]!.user_id as string;
    const boss = [owner, owner2].find((a) => a.id === survivor)!;
    await setUserActive(boss, staff2.id, false);
    expect((await t.sql`SELECT is_active FROM profiles WHERE id = ${staff2.id}`)[0]!.is_active).toBe(false);
    // an actor built from the now-inactive profile has no permissions at all
    const asInactive: Actor = { ...staff2, isActive: false };
    await expect(listUsers(asInactive)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setUserActive(boss, staff2.id, true);
    expect((await t.sql`SELECT is_active FROM profiles WHERE id = ${staff2.id}`)[0]!.is_active).toBe(true);
    const actions = (await t.sql`SELECT action FROM audit_logs WHERE entity_id = ${staff2.id} AND action LIKE 'user.%activated'`).map((r) => r.action).sort();
    expect(actions).toEqual(["user.deactivated", "user.reactivated"]);
    await expect(setUserActive(boss, boss.id, false)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
