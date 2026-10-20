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

export const ROLES = ["owner", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", staff: "Staff" };

export type Scope = "all" | "own";

type Grants = Partial<Record<Role, Scope>>;

const BOTH: Grants = { owner: "all", staff: "all" };
const OWNER: Grants = { owner: "all" };

/** Owner always holds every permission (asserted by a test). */
export const PERMISSIONS = {
  // Administration
  "users:manage": OWNER,
  "settings:manage": OWNER,
  "settings:view": BOTH,
  "website:manage": BOTH,
  "audit:view": OWNER,

  // Online orders
  "orders:view": BOTH,
  "orders:update": BOTH,
  "orders:cancel": BOTH,
  "orders:record_payment": BOTH,
  "orders:edit_items": BOTH,
  "orders:discount": OWNER,
  "orders:refund": OWNER,
  "orders:void_payment": OWNER,
  "orders:cases": BOTH,

  // Website messages (contact form, product enquiries, custom requests)
  "messages:view": BOTH,
  "messages:handle": BOTH,

  // Customers (built from their orders)
  "customers:view": BOTH,

  // Catalogue
  "products:view": BOTH,
  "products:write": BOTH,

  // Files
  "files:view_customer_private": BOTH,

  // Dashboard
  "dashboard:view": BOTH,
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
