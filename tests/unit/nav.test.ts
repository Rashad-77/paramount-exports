import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Actor, Role } from "@/lib/auth/permissions";
import { NAV, visibleNav } from "@/lib/nav";

const actor = (roles: Role[], isActive = true): Actor => ({ id: "u1", fullName: "T", roles, isActive });
const labels = (a: Actor) => visibleNav(a).flatMap((g) => g.modules.map((m) => m.label));
const pageLabels = (a: Actor) => visibleNav(a).flatMap((g) => g.modules.flatMap((m) => m.pages.map((p) => p.label)));

describe("navigation visibility", () => {
  it("never links to a page that does not exist", () => {
    const all = NAV.flatMap((g) => g.modules.flatMap((m) => m.pages));
    for (const i of all) {
      expect(existsSync(path.join(process.cwd(), "src/app", i.href, "page.tsx")), `${i.label} → ${i.href}`).toBe(true);
    }
    const shown = visibleNav(actor(["owner"])).flatMap((g) => g.modules.flatMap((m) => m.pages.map((p) => p.href)));
    expect(shown).toContain("/app");
  });

  it("shows the order screens to staff and the owner", () => {
    for (const r of ["owner", "staff"] as Role[]) {
      expect(labels(actor([r])), r).toEqual(expect.arrayContaining(["Dashboard", "Orders", "Quotations", "Enquiries", "Customers", "Products", "Settings"]));
    }
  });

  it("no longer offers any CRM or ERP screen", () => {
    const l = pageLabels(actor(["owner"]));
    for (const gone of ["Follow-ups", "Sales Orders", "Production", "Stock", "Materials", "Transfers", "Locations", "Suppliers", "Purchase Orders", "Deliveries", "After-Sales Service", "Invoicing", "Expenses", "Reports", "Employees"]) {
      expect(l, gone).not.toContain(gone);
    }
  });

  it("has no Users menu: the owner is the only person signing in", () => {
    expect(labels(actor(["owner"]))).not.toContain("Users");
    expect(labels(actor(["staff"]))).not.toContain("Users");
  });

  it("groups screens into modules and lists a module's other screens as tabs", () => {
    expect(pageLabels(actor(["owner"]))).toEqual(expect.arrayContaining(["Categories", "Reviews"]));
    const products = visibleNav(actor(["owner"])).flatMap((g) => g.modules).find((m) => m.label === "Products")!;
    expect(products.href).toBe("/app/products");
    expect(products.pages.map((x) => x.label)).toEqual(["Products"]);
    expect(visibleNav(actor(["owner"])).flatMap((g) => g.modules).some((m) => m.label === "Website")).toBe(false); // the Website section is gone
    const categories = visibleNav(actor(["owner"])).flatMap((g) => g.modules).find((m) => m.label === "Categories")!;
    expect(categories.href).toBe("/app/categories"); // Categories has its own entry under Catalogue
  });

  it("shows nothing to inactive users and drops empty groups", () => {
    expect(visibleNav(actor(["owner"], false))).toEqual([]);
    for (const g of visibleNav(actor(["staff"]))) expect(g.modules.length).toBeGreaterThan(0);
  });
});
