import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Actor, Role } from "@/lib/auth/permissions";
import { NAV, visibleNav, type NavGroup } from "@/lib/nav";

const actor = (roles: Role[], isActive = true): Actor => ({ id: "u1", fullName: "T", roles, isActive });

// Pretend every module is built so we can test role filtering independent of build progress.
const allBuilt: NavGroup[] = NAV.map((g) => ({ ...g, modules: g.modules.map((m) => ({ ...m, pages: m.pages.map((p) => ({ ...p, available: true })) })) }));
const labels = (a: Actor) => visibleNav(a, allBuilt).flatMap((g) => g.modules.map((m) => m.label));
const pageLabels = (a: Actor) => visibleNav(a, allBuilt).flatMap((g) => g.modules.flatMap((m) => m.pages.map((p) => p.label)));

describe("navigation visibility", () => {
  it("never links to a page that does not exist (and hides anything marked unbuilt)", () => {
    const all = NAV.flatMap((g) => g.modules.flatMap((m) => m.pages));
    for (const i of all.filter((x) => x.available)) {
      expect(existsSync(path.join(process.cwd(), "src/app", i.href, "page.tsx")), `${i.label} → ${i.href}`).toBe(true);
    }
    const unbuilt = all.filter((i) => !i.available);
    const shown = visibleNav(actor(["owner"])).flatMap((g) => g.modules.flatMap((m) => m.pages.map((p) => p.href)));
    for (const i of unbuilt) expect(shown).not.toContain(i.href);
    expect(shown).toContain("/app");
  });

  it("hides finance and customer areas from the workshop", () => {
    const l = labels(actor(["workshop"]));
    expect(l).toContain("Production");
    // Workshop staff get their own deliveries and the operations report (their jobs only); never sales or financial figures.
    expect(l).toEqual(expect.arrayContaining(["Deliveries", "Reports"]));
    expect(l).not.toContain("Enquiries");
    for (const hidden of ["Customers", "Invoicing", "Expenses", "Quotations", "Sales Orders", "Employees"]) {
      expect(l, hidden).not.toContain(hidden);
    }
  });

  it("hides workshop customer files and CRM from finance but shows payments and expenses", () => {
    const l = labels(actor(["finance"]));
    expect(l).toEqual(expect.arrayContaining(["Invoicing", "Expenses", "Reports"]));
    expect(l).not.toContain("Enquiries");
    expect(l).not.toContain("Employees");
  });

  it("shows user management to the owner only", () => {
    expect(labels(actor(["owner"]))).toContain("Employees");
    expect(labels(actor(["manager"]))).not.toContain("Employees");
  });

  it("groups screens into modules and lists a module's other screens as tabs", () => {
    const p = pageLabels(actor(["owner"]));
    expect(p).toEqual(expect.arrayContaining(["Follow-ups", "Materials", "Transfers", "Locations", "Purchase Orders", "Gallery"]));
    const inventory = visibleNav(actor(["owner"]), allBuilt).flatMap((g) => g.modules).find((m) => m.label === "Inventory")!;
    expect(inventory.href).toBe("/app/stock");
    expect(inventory.pages.map((x) => x.label)).toEqual(["Stock", "Materials", "Transfers", "Locations"]);
    // A role that may only see materials still reaches the Inventory module, through Materials.
    const wm = visibleNav(actor(["workshop"]), allBuilt).flatMap((g) => g.modules).find((m) => m.label === "Inventory");
    expect(wm?.pages.length).toBeGreaterThan(0);
  });

  it("shows nothing to inactive users and drops empty groups", () => {
    expect(visibleNav(actor(["owner"], false), allBuilt)).toEqual([]);
    for (const g of visibleNav(actor(["sales"]), allBuilt)) expect(g.modules.length).toBeGreaterThan(0);
  });
});
