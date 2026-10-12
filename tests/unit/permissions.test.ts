import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  ROLES,
  can,
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

  it("restricts sensitive configuration to the Owner", () => {
    for (const p of ["users:manage", "settings:manage"] as Permission[]) {
      for (const r of ROLES) expect(can(actor([r]), p), `${r} ${p}`).toBe(r === "owner");
    }
  });
});

describe("least-privilege guarantees (must never regress)", () => {
  const workshopForbidden: Permission[] = [
    "customers:view",
    "customers:write",
    "leads:view",
    "quotations:view",
    "orders:view",
    "payments:view",
    "payments:record",
    "production:view_costs",
    "expenses:view",
    "reports:financial",
    "reports:sales",
    "files:view_finance",
    "users:manage",
    "settings:view",
    "audit:view",
  ];
  it.each(workshopForbidden)("Workshop cannot %s", (p) => {
    expect(can(actor(["workshop"]), p)).toBe(false);
  });

  it("Workshop job access is scoped to own jobs, not all jobs", () => {
    const w = actor(["workshop"]);
    expect(scopeOf(w, "production:view")).toBe("own");
    expect(scopeOf(w, "production:update_stage")).toBe("own");
    expect(scopeOf(w, "production:record_materials")).toBe("own");
    expect(scopeOf(w, "files:view_customer_private")).toBe("own");
  });

  it("Finance cannot see customer-uploaded private files or workshop operations", () => {
    const f = actor(["finance"]);
    expect(can(f, "files:view_customer_private")).toBe(false);
    expect(can(f, "production:update_stage")).toBe(false);
    expect(can(f, "inventory:adjust")).toBe(false);
    expect(can(f, "users:manage")).toBe(false);
  });

  it("Finance can see finance data", () => {
    const f = actor(["finance"]);
    for (const p of ["payments:view", "payments:record", "payments:void", "expenses:write", "reports:financial", "files:view_finance"] as Permission[]) {
      expect(can(f, p), p).toBe(true);
    }
  });

  it("Sales cannot adjust stock, void payments, override discounts or see financial reports", () => {
    const s = actor(["sales"]);
    for (const p of ["inventory:adjust", "payments:void", "quotations:discount_override", "reports:financial", "orders:cancel_paid", "expenses:view"] as Permission[]) {
      expect(can(s, p), p).toBe(false);
    }
  });

  it("Sales sees only payments on own orders", () => {
    expect(scopeOf(actor(["sales"]), "payments:view")).toBe("own");
  });

  it("Manager cannot manage users or sensitive settings", () => {
    const m = actor(["manager"]);
    expect(can(m, "users:manage")).toBe(false);
    expect(can(m, "settings:manage")).toBe(false);
    expect(can(m, "inventory:adjust")).toBe(true);
  });
});

describe("multiple roles", () => {
  it("unions permissions and lets 'all' beat 'own'", () => {
    const both = actor(["workshop", "manager"]);
    expect(scopeOf(both, "production:view")).toBe("all");
    expect(can(both, "payments:view")).toBe(true);

    const salesFinance = actor(["sales", "finance"]);
    expect(scopeOf(salesFinance, "payments:view")).toBe("all");
    expect(can(salesFinance, "users:manage")).toBe(false);
  });
});

describe("requirePermission", () => {
  it("throws UNAUTHENTICATED without an actor", () => {
    try {
      requirePermission(null, "customers:view");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("throws FORBIDDEN when the role lacks the permission", () => {
    try {
      requirePermission(actor(["workshop"]), "payments:view");
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).status).toBe(403);
    }
  });

  it("returns the effective scope when allowed", () => {
    expect(requirePermission(actor(["workshop"]), "production:view")).toBe("own");
    expect(requirePermission(actor(["manager"]), "production:view")).toBe("all");
  });
});
