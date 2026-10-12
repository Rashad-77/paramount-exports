import { forbidden, unauthenticated } from "@/lib/errors";

/**
 * Single source of truth for authorization. docs/ROLE_PERMISSIONS.md contains a table
 * generated from this file (`pnpm docs:permissions`); a test fails if they drift.
 *
 * Scope:
 *  - "all": every record the permission applies to
 *  - "own": only records assigned to / owned by the actor — services MUST filter in the
 *           database query (e.g. WHERE assigned_to = actor.id), not after fetching.
 */

export const ROLES = ["owner", "manager", "sales", "workshop", "finance"] as const;
export type Role = (typeof ROLES)[number];

export type Scope = "all" | "own";

type Grants = Partial<Record<Role, Scope>>;

const OM: Grants = { owner: "all", manager: "all" };
const OMS: Grants = { ...OM, sales: "all" };
const OMF: Grants = { ...OM, finance: "all" };

/** Owner always holds every permission (asserted by a test). */
export const PERMISSIONS = {
  // Administration
  "users:manage": { owner: "all" },
  "settings:manage": { owner: "all" },
  "settings:view": OM,
  "website:manage": OM,
  "audit:view": OM,

  // CRM
  "customers:view": { ...OMS, finance: "all" },
  "customers:write": OMS,
  "leads:view": OMS,
  "leads:write": OMS,
  "leads:assign": OMS,
  "followups:manage": OMS,

  // Quotations
  "quotations:view": { ...OMS, finance: "all" },
  "quotations:write": OMS,
  "quotations:send": OMS,
  "quotations:convert": OMS,
  "quotations:discount_override": OM,

  // Orders & payments
  "orders:view": { ...OMS, finance: "all" },
  "orders:write": OMS,
  "orders:confirm": OMS,
  "orders:cancel": OMS,
  "orders:cancel_paid": OM,
  "payments:view": { ...OM, sales: "own", finance: "all" },
  "payments:record": { ...OMF, sales: "all" },
  "payments:void": OMF,

  // Catalogue & inventory
  "products:view": { ...OMS, workshop: "all", finance: "all" },
  "products:write": OM,
  "inventory:view": { ...OMS, workshop: "all", finance: "all" },
  "inventory:view_materials": { ...OM, workshop: "all", finance: "all" },
  "inventory:adjust": OM,
  "inventory:transfer": { ...OMS, workshop: "all" },

  // Workshop
  "production:view": { ...OM, workshop: "own" },
  "production:view_status": { ...OM, sales: "all" },
  "production:write": OM,
  "production:update_stage": { ...OM, workshop: "own" },
  "production:record_materials": { ...OM, workshop: "own" },
  "production:view_costs": OMF,

  // Purchasing
  "suppliers:view": { ...OM, workshop: "all", finance: "all" },
  "suppliers:write": OM,
  "purchasing:write": OM,
  "purchasing:receive": { ...OM, workshop: "all" },
  "purchasing:record_payment": OMF,

  // Delivery & after-sales
  "deliveries:view": { ...OMS, workshop: "own", finance: "all" },
  "deliveries:write": OMS,
  "deliveries:update_status": { ...OMS, workshop: "own" },
  "aftersales:view": { ...OMS, workshop: "all" },
  "aftersales:manage": OMS,

  // Finance & reports
  "expenses:view": OMF,
  "expenses:write": OMF,
  "reports:sales": { ...OM, sales: "own", finance: "all" },
  "reports:financial": OMF,
  "reports:operations": { ...OM, workshop: "own" },

  // Files
  "files:view_customer_private": { ...OMS, workshop: "own" },
  "files:view_finance": OMF,

  // Dashboards
  "dashboard:owner": OM,
  "dashboard:sales": { owner: "all", manager: "all", sales: "all" },
  "dashboard:workshop": { owner: "all", manager: "all", workshop: "all" },
  "dashboard:finance": { owner: "all", manager: "all", finance: "all" },
} as const satisfies Record<string, Grants>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** The authenticated staff member as seen by services. Produced by `getActor()` or built directly in tests. */
export interface Actor {
  id: string;
  fullName: string;
  roles: readonly Role[];
  isActive: boolean;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/**
 * Effective scope for a permission across all of the actor's roles ("all" beats "own"),
 * or `null` if the actor may not do it. Inactive actors can do nothing.
 */
export function scopeOf(actor: Actor | null | undefined, permission: Permission): Scope | null {
  if (!actor || !actor.isActive) return null;
  const grants: Grants = PERMISSIONS[permission];
  let best: Scope | null = null;
  for (const role of actor.roles) {
    const scope = grants[role];
    if (scope === "all") return "all";
    if (scope === "own") best = "own";
  }
  return best;
}

export const can = (actor: Actor | null | undefined, permission: Permission): boolean =>
  scopeOf(actor, permission) !== null;

/**
 * Call at the top of every service function. Returns the effective scope so the caller can
 * restrict its query when the scope is "own".
 */
export function requirePermission(actor: Actor | null | undefined, permission: Permission): Scope {
  if (!actor) throw unauthenticated();
  const scope = scopeOf(actor, permission);
  if (!scope) throw forbidden();
  return scope;
}

/** Markdown table for docs/ROLE_PERMISSIONS.md. */
export function renderPermissionMatrix(): string {
  const cell = (s: Scope | undefined) => (s === "all" ? "✓" : s === "own" ? "own" : "—");
  const header = `| Permission | ${ROLES.map((r) => r[0]!.toUpperCase() + r.slice(1)).join(" | ")} |`;
  const sep = `|---|${ROLES.map(() => ":-:").join("|")}|`;
  const rows = ALL_PERMISSIONS.map((p) => {
    const g: Grants = PERMISSIONS[p];
    return `| \`${p}\` | ${ROLES.map((r) => cell(g[r])).join(" | ")} |`;
  });
  return [header, sep, ...rows].join("\n");
}
