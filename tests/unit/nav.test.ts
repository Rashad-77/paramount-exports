import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Actor, Role } from "@/lib/auth/permissions";
import { NAV, visibleNav, type NavGroup } from "@/lib/nav";

const actor = (roles: Role[], isActive = true): Actor => ({ id: "u1", fullName: "T", roles, isActive });

// Pretend every module is built so we can test role filtering independent of build progress.
const allBuilt: NavGroup[] = NAV.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, available: true })) }));
const labels = (a: Actor) => visibleNav(a, allBuilt).flatMap((g) => g.items.map((i) => i.label));

describe("navigation visibility", () => {
  it("never links to a page that does not exist (and hides anything marked unbuilt)", () => {
    const all = NAV.flatMap((g) => g.items);
    for (const i of all.filter((x) => x.available)) {
      expect(existsSync(path.join(process.cwd(), "src/app", i.href, "page.tsx")), `${i.label} → ${i.href}`).toBe(true);
    }
    const unbuilt = all.filter((i) => !i.available);
    const shown = visibleNav(actor(["owner"])).flatMap((g) => g.items.map((i) => i.href));
    for (const i of unbuilt) expect(shown).not.toContain(i.href);
    expect(shown).toContain("/app");
  });

  it("hides finance and customer areas from the workshop", () => {
    const l = labels(actor(["workshop"]));
    expect(l).toContain("Production jobs");
    // Workshop staff get their own deliveries and the operations report (their jobs only); never sales or financial figures.
    expect(l).toEqual(expect.arrayContaining(["Deliveries", "Reports"]));
    expect(l).not.toContain("Enquiries & leads");
    for (const hidden of ["Customers", "Outstanding balances", "Expenses", "Quotations", "Orders", "Users"]) {
      expect(l, hidden).not.toContain(hidden);
    }
  });

  it("hides workshop customer files and CRM from finance but shows payments and expenses", () => {
    const l = labels(actor(["finance"]));
    expect(l).toEqual(expect.arrayContaining(["Outstanding balances", "Expenses", "Reports"]));
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
