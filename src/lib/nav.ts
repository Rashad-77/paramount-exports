import { can, type Actor, type Permission } from "@/lib/auth/permissions";

/**
 * Internal navigation, grouped per the brief: Overview, CRM, Sales, Inventory, Workshop, Purchasing,
 * Deliveries, Finance/Reports, Settings.
 *
 * - `permission` hides destinations a role may not use (the server still enforces access on every route).
 * - `available` is false for modules that are planned but not built yet. Unbuilt destinations are never
 *   rendered, so there are no links that lead nowhere. Flip to true in the same commit that adds the route.
 */
export interface NavItem {
  label: string;
  href: string;
  permission: Permission | null; // null = any active staff member
  available: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/app", permission: null, available: true }] },
  {
    label: "CRM",
    items: [
      { label: "Enquiries & leads", href: "/app/leads", permission: "leads:view", available: true },
      { label: "Customers", href: "/app/customers", permission: "customers:view", available: true },
      { label: "Follow-ups", href: "/app/follow-ups", permission: "followups:manage", available: true },
      { label: "Quotations", href: "/app/quotations", permission: "quotations:view", available: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/app/orders", permission: "orders:view", available: true },
      { label: "Outstanding balances", href: "/app/payments", permission: "payments:view", available: true },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", href: "/app/products", permission: "products:view", available: true },
      { label: "Categories", href: "/app/categories", permission: "products:view", available: true },
      { label: "Stock", href: "/app/stock", permission: "inventory:view", available: true },
      { label: "Transfers", href: "/app/transfers", permission: "inventory:transfer", available: true },
      { label: "Locations", href: "/app/locations", permission: "inventory:view", available: true },
    ],
  },
  {
    label: "Workshop",
    items: [
      { label: "Production jobs", href: "/app/jobs", permission: "production:view", available: false },
      { label: "Materials", href: "/app/materials", permission: "inventory:view_materials", available: true },
    ],
  },
  {
    label: "Purchasing",
    items: [
      { label: "Suppliers", href: "/app/suppliers", permission: "suppliers:view", available: false },
      { label: "Purchase orders", href: "/app/purchase-orders", permission: "purchasing:write", available: false },
    ],
  },
  { label: "Deliveries", items: [{ label: "Deliveries", href: "/app/deliveries", permission: "deliveries:view", available: false }] },
  {
    label: "Finance & reports",
    items: [
      { label: "Expenses", href: "/app/expenses", permission: "expenses:view", available: false },
      { label: "Reports", href: "/app/reports", permission: "reports:sales", available: false },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Business & pages", href: "/app/settings", permission: "settings:view", available: true },
      { label: "Website gallery", href: "/app/gallery", permission: "website:manage", available: true },
      { label: "Users", href: "/app/users", permission: "users:manage", available: false },
    ],
  },
];

/** Navigation filtered to what this actor may see and what is actually built. Empty groups are dropped. */
export function visibleNav(actor: Actor, groups: NavGroup[] = NAV): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.available && (i.permission === null ? actor.isActive : can(actor, i.permission))),
    }))
    .filter((g) => g.items.length > 0);
}
