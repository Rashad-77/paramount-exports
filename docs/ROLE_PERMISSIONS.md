# Role & Permission Matrix

There are two roles. **Owner** can do everything. **Staff** runs the day-to-day work: orders, messages, customers, the catalogue,
the gallery and the website page wording. Staff cannot manage users, change business settings or read the audit log.
Users may hold both roles; effective permissions are the **union**.
Legend: **✓** allowed · **—** no access.

The matrix below is **generated from `src/lib/auth/permissions.ts`** (run `pnpm docs:permissions` after changing it).
A unit test fails if this table and the code disagree, so review changes to the code like changes to this document.

<!-- PERMISSION_MATRIX:START (generated from src/lib/auth/permissions.ts — do not edit by hand) -->
| Permission | Owner | Staff |
|---|:-:|:-:|
| `users:manage` | ✓ | — |
| `settings:manage` | ✓ | — |
| `settings:view` | ✓ | ✓ |
| `website:manage` | ✓ | ✓ |
| `audit:view` | ✓ | — |
| `orders:view` | ✓ | ✓ |
| `orders:update` | ✓ | ✓ |
| `orders:cancel` | ✓ | ✓ |
| `orders:record_payment` | ✓ | ✓ |
| `orders:discount` | ✓ | — |
| `orders:void_payment` | ✓ | — |
| `orders:refund` | ✓ | — |
| `messages:view` | ✓ | ✓ |
| `messages:handle` | ✓ | ✓ |
| `customers:view` | ✓ | ✓ |
| `products:view` | ✓ | ✓ |
| `products:write` | ✓ | ✓ |
| `files:view_customer_private` | ✓ | ✓ |
| `dashboard:view` | ✓ | ✓ |
<!-- PERMISSION_MATRIX:END -->

## Rules the matrix cannot express (enforced in services, tested per module)

- **Public (signed-out) visitors** may only: read published catalogue, gallery and settings, **place an order**, send enquiry or contact
  forms, and upload pictures to the enquiry quarantine area. Nothing else. They never see another person's order.
- **Inactive profiles** have no permissions even with a valid session.
- **Retired roles** (`manager`, `sales`, `workshop`, `finance`) still exist in the database enum but are ignored by the app; a person who
  held only those has no access until given Owner or Staff.
- **Orders are never deleted.** An order is cancelled with a reason, and delivered and cancelled orders are final.
- **"Paid" is set by staff only**, never by the website.
- **There is always at least one active owner**: the last one cannot be demoted or deactivated.
- **Always written to `audit_logs`**: placing an order, every status change, delivery-charge changes, marking paid or unpaid, message
  handling, user and role changes, settings changes, and private-file access by non-owners.

## Test requirements

1. Matrix equality: this document and `permissions.ts` (unit test, runs in CI).
2. The Owner holds every permission; inactive and role-less actors hold none.
3. Explicit "must never" assertions: only the Owner manages users, settings and the audit log.
4. Every staff service function calls `requirePermission` first and is covered by a refusal test (`orders.db`, `catalogue.db`, `users.db`).
5. DB-level: the `anon` and `authenticated` Postgres roles hold no privileges on any `public` table (`foundation.db`).
