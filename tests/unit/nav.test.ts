import { describe, expect, it } from "vitest";
import type { Actor, Role } from "@/lib/auth/permissions";
import { NAV, visibleNav, type NavGroup } from "@/lib/nav";

const actor = (roles: Role[], isActive = true): Actor => ({ id: "u1", fullName: "T", roles, isActive });

// Pretend every module is built so we can test role filtering independent of build progress.
const allBuilt: NavGroup[] = NAV.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, available: true })) }));
const labels = (a: Actor) => visibleNav(a, allBuilt).flatMap((g) => g.items.map((i) => i.label));

describe("navigation visibility", () => {
  it("never shows unbuilt destinations (no dead links)", () => {
    const shown = visibleNav(actor(["owner"])).flatMap((g) => g.items.map((i) => i.href));
    expect(shown).toEqual(["/app"]);
  });

  it("hides finance and customer areas from the workshop", () => {
    const l = labels(actor(["workshop"]));
    expect(l).toContain("Production jobs");
    for (const hidden of ["Customers", "Payments", "Expenses", "Reports", "Quotations", "Orders", "Users"]) {
      expect(l, hidden).not.toContain(hidden);
    }
  });

  it("hides workshop customer files and CRM from finance but shows payments and expenses", () => {
    const l = labels(actor(["finance"]));
    expect(l).toEqual(expect.arrayContaining(["Payments", "Expenses", "Reports"]));
    expect(l).not.toContain("Enquiries & leads");
    expect(l).not.toContain("Users");
  });

  it("shows user management to the owner only", () => {
    expect(labels(actor(["owner"]))).toContain("Users");
    expect(labels(actor(["manager"]))).not.toContain("Users");
  });

  it("shows nothing to inactive users and drops empty groups", () => {
    expect(visibleNav(actor(["owner"], false), allBuilt)).toEqual([]);
    for (const g of visibleNav(actor(["sales"]), allBuilt)) expect(g.items.length).toBeGreaterThan(0);
  });
});
