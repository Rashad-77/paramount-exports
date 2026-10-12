import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { ROLES, requirePermission, type Actor, type Role } from "@/lib/auth/permissions";
import { getDb, withTx, type DbOrTx } from "@/lib/db/client";
import { profiles, userRoles } from "@/lib/db/schema";
import { invalidState, notFound, validation } from "@/lib/errors";
import { recordAudit } from "./audit";

/** Staff accounts for the Owner to manage. New accounts are created with `pnpm create-user` (see docs/OPERATIONS.md). */
export async function listUsers(actor: Actor) {
  requirePermission(actor, "users:manage");
  const rows = await getDb()
    .select({ id: profiles.id, name: profiles.fullName, isActive: profiles.isActive, role: userRoles.role })
    .from(profiles)
    .leftJoin(userRoles, eq(userRoles.userId, profiles.id))
    .orderBy(asc(profiles.fullName));
  const byId = new Map<string, { id: string; name: string; isActive: boolean; roles: Role[] }>();
  for (const r of rows) {
    const u = byId.get(r.id) ?? { id: r.id, name: r.name, isActive: r.isActive, roles: [] };
    if (r.role) u.roles.push(r.role);
    byId.set(r.id, u);
  }
  return [...byId.values()];
}

/** Count of active owners, optionally ignoring one person (used to refuse changes that would leave the business with none). */
async function otherActiveOwners(db: DbOrTx, exceptUserId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(profiles)
    .innerJoin(userRoles, eq(userRoles.userId, profiles.id))
    .where(and(eq(userRoles.role, "owner"), eq(profiles.isActive, true), ne(profiles.id, exceptUserId)));
  return r?.n ?? 0;
}

export async function setUserRoles(actor: Actor, userId: string, roles: string[]): Promise<void> {
  requirePermission(actor, "users:manage");
  const wanted = [...new Set(roles)];
  if (wanted.length === 0) throw validation("Give the person at least one role, or deactivate them instead.", { roles: ["Choose at least one role."] });
  const bad = wanted.filter((r) => !(ROLES as readonly string[]).includes(r));
  if (bad.length) throw validation("Unknown role.", { roles: ["Choose from the listed roles."] });
  await withTx(async (tx) => {
    // Serialise role/active changes so two owners cannot each remove the other at the same time.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7001)`);
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw notFound("That person could not be found.");
    const before = (await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId))).map((r) => r.role);
    const losesOwner = before.includes("owner") && !wanted.includes("owner");
    if (losesOwner && p.isActive && (await otherActiveOwners(tx, userId)) === 0) throw invalidState("There must always be at least one active owner. Make someone else an owner first.");
    const toRemove = before.filter((r) => !wanted.includes(r));
    const toAdd = wanted.filter((r) => !before.includes(r as Role));
    if (toRemove.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, userId), inArray(userRoles.role, toRemove)));
    if (toAdd.length) await tx.insert(userRoles).values(toAdd.map((role) => ({ userId, role: role as Role, grantedBy: actor.id })));
    await recordAudit(tx, actor, { action: "user.roles_changed", entityType: "profile", entityId: userId, before: { roles: before }, after: { roles: wanted } });
  });
}

export async function setUserActive(actor: Actor, userId: string, active: boolean): Promise<void> {
  requirePermission(actor, "users:manage");
  if (!active && userId === actor.id) throw invalidState("You cannot deactivate your own account.");
  await withTx(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7001)`);
    const [p] = await tx.select().from(profiles).where(eq(profiles.id, userId)).for("update");
    if (!p) throw notFound("That person could not be found.");
    if (!active && p.isActive) {
      const isOwner = (await tx.select({ id: userRoles.id }).from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, "owner")))).length > 0;
      if (isOwner && (await otherActiveOwners(tx, userId)) === 0) throw invalidState("There must always be at least one active owner.");
    }
    await tx.update(profiles).set({ isActive: active }).where(eq(profiles.id, userId));
    await recordAudit(tx, actor, { action: active ? "user.reactivated" : "user.deactivated", entityType: "profile", entityId: userId, before: { isActive: p.isActive }, after: { isActive: active } });
  });
}
