import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLES,
  can,
  isRole,
  renderPermissionMatrix,
  requirePermission,
  scopeOf,
  type Actor,
  type Permission,
  type Role,
} from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";

const actor = (roles: Role[], overrides: Partial<Actor> = {}): Actor => ({
  id: "00000000-0000-0000-0000-000000000001",
  fullName: "Test User",
  roles,
  isActive: true,
  ...overrides,
});

describe("permission matrix", () => {
  it("is exactly what docs/ROLE_PERMISSIONS.md shows (run `pnpm docs:permissions` if this fails)", () => {
    const doc = fs.readFileSync(path.join(process.cwd(), "docs", "ROLE_PERMISSIONS.md"), "utf8");
    const match = doc.match(/<!-- PERMISSION_MATRIX:START[^>]*-->\n([\s\S]*?)\n<!-- PERMISSION_MATRIX:END -->/);
    expect(match, "matrix markers missing in docs").not.toBeNull();
    expect(match![1]).toBe(renderPermissionMatrix());
  });

  it("has exactly two roles: owner and staff", () => {
    expect([...ROLES]).toEqual(["owner", "staff"]);
    expect(isRole("staff")).toBe(true);
    for (const retired of ["manager", "sales", "workshop", "finance"]) expect(isRole(retired), retired).toBe(false);
  });

  it("gives the Owner every permission with full scope", () => {
    for (const p of ALL_PERMISSIONS) expect(scopeOf(actor(["owner"]), p), p).toBe("all");
  });

  it("only references known roles", () => {
    for (const p of ALL_PERMISSIONS) {
      for (const r of Object.keys(PERMISSIONS[p])) expect(ROLES as readonly string[]).toContain(r);
    }
  });

  it("denies everything to inactive users and users without roles", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(can(actor(["owner"], { isActive: false }), p), p).toBe(false);
      expect(can(actor([]), p), p).toBe(false);
      expect(can(null, p), p).toBe(false);
      expect(can(undefined, p), p).toBe(false);
    }
  });
});

describe("least-privilege guarantees (must never regress)", () => {
  it("restricts users, settings changes and the audit log to the Owner", () => {
    for (const p of ["users:manage", "settings:manage", "audit:view"] as Permission[]) {
      for (const r of ROLES) expect(can(actor([r]), p), `${r} ${p}`).toBe(r === "owner");
    }
  });

  it("lets Staff run orders, messages, customers, the catalogue and the website pages", () => {
    const s = actor(["staff"]);
    for (const p of [
      "orders:view",
      "orders:update",
      "orders:cancel",
      "orders:record_payment",
      "messages:view",
      "messages:handle",
      "customers:view",
      "products:view",
      "products:write",
      "website:manage",
      "files:view_customer_private",
      "dashboard:view",
      "settings:view",
    ] as Permission[]) {
      expect(can(s, p), p).toBe(true);
    }
  });

  it("every permission is held either by Staff and Owner, or by the Owner alone", () => {
    for (const p of ALL_PERMISSIONS) {
      const holders = ROLES.filter((r) => PERMISSIONS[p][r as keyof (typeof PERMISSIONS)[typeof p]]);
      expect(holders[0], p).toBe("owner");
      expect([1, 2]).toContain(holders.length);
    }
  });
});

describe("requirePermission", () => {
  it("throws UNAUTHENTICATED without an actor", () => {
    try {
      requirePermission(null, "orders:view");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("throws FORBIDDEN when the role lacks the permission", () => {
    try {
      requirePermission(actor(["staff"]), "users:manage");
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).status).toBe(403);
    }
  });

  it("returns the effective scope when allowed", () => {
    expect(requirePermission(actor(["staff"]), "orders:view")).toBe("all");
  });
});
