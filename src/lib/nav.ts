import { can, type Actor, type Permission } from "@/lib/auth/permissions";

/**
 * Internal navigation: a few groups, one entry per module.
 *
 * - A module with several screens lists them as `pages`; the first page the person may open is where the entry links,
 *   and the module's other screens appear as tabs above the page.
 * - `permission` hides screens a role may not use (the server still enforces access on every route).
 * - `available` is false for screens that are planned but not built. Unbuilt screens are never rendered, so no link
 *   leads nowhere. Flip to true in the same commit that adds the route.
 */
export interface NavPage {
  label: string;
  href: string;
  permission: Permission | null; // null = any active staff member
  available: boolean;
}
export interface NavModule {
  label: string;
  /** What the module covers. Shown under the title of its main screen. */
  description: string;
  pages: NavPage[];
}
export interface NavGroup {
  label: string;
  modules: NavModule[];
}

const page = (label: string, href: string, permission: Permission | null): NavPage => ({ label, href, permission, available: true });

export const NAV: NavGroup[] = [
  {
    label: "General",
    modules: [{ label: "Dashboard", description: "New orders, what needs doing today, and recent activity.", pages: [page("Dashboard", "/app", null)] }],
  },
  {
    label: "Sales",
    modules: [
      { label: "Orders", description: "Orders placed on the website, from new to completed: confirm them, follow production, and record payment when it arrives.", pages: [page("Orders", "/app/orders", "orders:view")] },
      { label: "Quotations", description: "Requests for made-to-measure furniture: review them, send a price, and turn accepted quotations into orders.", pages: [page("Quotations", "/app/quotations", "messages:view")] },
      { label: "Enquiries", description: "Questions from the contact form and from product pages, from new to responded.", pages: [page("Enquiries", "/app/enquiries", "messages:view")] },
    ],
  },
  {
    label: "Fulfilment",
    modules: [
      { label: "Delivery and collection", description: "Orders ready to go out, on the road, delivered, and collected from the showroom, with the delivery charges agreed.", pages: [page("Delivery and collection", "/app/delivery", "orders:view")] },
    ],
  },
  {
    label: "Catalogue",
    modules: [
      {
        label: "Products",
        description: "The furniture shown on the website: options, prices, photographs and what is published.",
        pages: [page("Products", "/app/products", "products:view"), page("Categories", "/app/categories", "products:view")],
      },
    ],
  },
  {
    label: "People",
    modules: [{ label: "Customers", description: "People who have ordered, asked for a quotation or written to you, with their contact details and history.", pages: [page("Customers", "/app/customers", "customers:view")] }],
  },
  {
    label: "Business",
    modules: [
      { label: "Showroom and workshop", description: "Contact details, opening hours, and the photographs of the showroom and the workshop.", pages: [page("Showroom and workshop", "/app/showroom", "website:manage")] },
      {
        label: "Website",
        description: "Page wording and the gallery of finished projects.",
        pages: [page("Pages", "/app/website", "website:manage"), page("Gallery", "/app/gallery", "website:manage")],
      },
    ],
  },
  {
    label: "System",
    modules: [
      { label: "Users", description: "Who can sign in to this area, and whether they are an owner or staff.", pages: [page("Users", "/app/users", "users:manage")] },
      { label: "Settings", description: "Business name, contact details, opening hours and bank details for transfers.", pages: [page("Settings", "/app/settings", "settings:view")] },
    ],
  },
];

export interface VisibleModule {
  label: string;
  description: string;
  /** Where the sidebar entry links: the first screen this person may open. */
  href: string;
  pages: { label: string; href: string }[];
}
export interface VisibleGroup {
  label: string;
  modules: VisibleModule[];
}

const allowed = (actor: Actor, p: NavPage) => p.available && (p.permission === null ? actor.isActive : can(actor, p.permission));

/** Navigation filtered to what this actor may see and what is actually built. Empty modules and groups are dropped. */
export function visibleNav(actor: Actor, groups: NavGroup[] = NAV): VisibleGroup[] {
  return groups
    .map((g) => ({
      label: g.label,
      modules: g.modules
        .map((m) => ({ ...m, pages: m.pages.filter((p) => allowed(actor, p)) }))
        .filter((m) => m.pages.length > 0)
        .map((m) => ({ label: m.label, description: m.description, href: m.pages[0]!.href, pages: m.pages.map((p) => ({ label: p.label, href: p.href })) })),
    }))
    .filter((g) => g.modules.length > 0);
}

/** The module this screen belongs to, with only the screens this person may open. Null when it is not a navigation screen. */
export function visibleModuleFor(actor: Actor, href: string): VisibleModule | null {
  return visibleNav(actor).flatMap((g) => g.modules).find((m) => m.pages.some((p) => p.href === href)) ?? null;
}

/** The module a screen belongs to: its name and description. */
export function moduleInfo(href: string): { title: string; description: string } {
  for (const g of NAV)
    for (const m of g.modules) if (m.pages.some((x) => x.href === href)) return { title: m.label, description: m.description };
  throw new Error(`No navigation entry for ${href}`);
}
