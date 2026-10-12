# Role & Permission Matrix

Least-privilege starting point. Users may hold several roles; effective permissions are the **union**
("all" beats "own"). Legend: **✓** all records · **own** only records assigned to the user · **—** no access.

The matrix below is **generated from `src/lib/auth/permissions.ts`** (run `pnpm docs:permissions` after changing it).
A unit test fails if this table and the code disagree, so review changes to the code like changes to this document.

<!-- PERMISSION_MATRIX:START (generated from src/lib/auth/permissions.ts — do not edit by hand) -->
| Permission | Owner | Manager | Sales | Workshop | Finance |
|---|:-:|:-:|:-:|:-:|:-:|
| `users:manage` | ✓ | — | — | — | — |
| `settings:manage` | ✓ | — | — | — | — |
| `settings:view` | ✓ | ✓ | — | — | — |
| `website:manage` | ✓ | ✓ | — | — | — |
| `audit:view` | ✓ | ✓ | — | — | — |
| `customers:view` | ✓ | ✓ | ✓ | — | ✓ |
| `customers:write` | ✓ | ✓ | ✓ | — | — |
| `leads:view` | ✓ | ✓ | ✓ | — | — |
| `leads:write` | ✓ | ✓ | ✓ | — | — |
| `leads:assign` | ✓ | ✓ | ✓ | — | — |
| `followups:manage` | ✓ | ✓ | ✓ | — | — |
| `quotations:view` | ✓ | ✓ | ✓ | — | ✓ |
| `quotations:write` | ✓ | ✓ | ✓ | — | — |
| `quotations:send` | ✓ | ✓ | ✓ | — | — |
| `quotations:convert` | ✓ | ✓ | ✓ | — | — |
| `quotations:discount_override` | ✓ | ✓ | — | — | — |
| `orders:view` | ✓ | ✓ | ✓ | — | ✓ |
| `orders:write` | ✓ | ✓ | ✓ | — | — |
| `orders:confirm` | ✓ | ✓ | ✓ | — | — |
| `orders:cancel` | ✓ | ✓ | ✓ | — | — |
| `orders:cancel_paid` | ✓ | ✓ | — | — | — |
| `payments:view` | ✓ | ✓ | own | — | ✓ |
| `payments:record` | ✓ | ✓ | ✓ | — | ✓ |
| `payments:void` | ✓ | ✓ | — | — | ✓ |
| `products:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `products:write` | ✓ | ✓ | — | — | — |
| `inventory:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `inventory:view_materials` | ✓ | ✓ | — | ✓ | ✓ |
| `inventory:adjust` | ✓ | ✓ | — | — | — |
| `inventory:transfer` | ✓ | ✓ | ✓ | ✓ | — |
| `production:view` | ✓ | ✓ | — | own | — |
| `production:view_status` | ✓ | ✓ | ✓ | — | — |
| `production:write` | ✓ | ✓ | — | — | — |
| `production:update_stage` | ✓ | ✓ | — | own | — |
| `production:record_materials` | ✓ | ✓ | — | own | — |
| `production:view_costs` | ✓ | ✓ | — | — | ✓ |
| `suppliers:view` | ✓ | ✓ | — | ✓ | ✓ |
| `suppliers:write` | ✓ | ✓ | — | — | — |
| `purchasing:view` | ✓ | ✓ | — | ✓ | ✓ |
| `purchasing:write` | ✓ | ✓ | — | — | — |
| `purchasing:receive` | ✓ | ✓ | — | ✓ | — |
| `purchasing:record_payment` | ✓ | ✓ | — | — | ✓ |
| `deliveries:view` | ✓ | ✓ | ✓ | own | ✓ |
| `deliveries:write` | ✓ | ✓ | ✓ | — | — |
| `deliveries:update_status` | ✓ | ✓ | ✓ | own | — |
| `aftersales:view` | ✓ | ✓ | ✓ | ✓ | — |
| `aftersales:manage` | ✓ | ✓ | ✓ | — | — |
| `expenses:view` | ✓ | ✓ | — | — | ✓ |
| `expenses:write` | ✓ | ✓ | — | — | ✓ |
| `reports:sales` | ✓ | ✓ | own | — | ✓ |
| `reports:financial` | ✓ | ✓ | — | — | ✓ |
| `reports:operations` | ✓ | ✓ | — | own | — |
| `files:view_customer_private` | ✓ | ✓ | ✓ | own | — |
| `files:view_finance` | ✓ | ✓ | — | — | ✓ |
| `dashboard:owner` | ✓ | ✓ | — | — | — |
| `dashboard:sales` | ✓ | ✓ | ✓ | — | — |
| `dashboard:workshop` | ✓ | ✓ | — | ✓ | — |
| `dashboard:finance` | ✓ | ✓ | — | — | ✓ |
<!-- PERMISSION_MATRIX:END -->

## Rules the matrix cannot express (enforced in services, tested per module)

- **Workshop never sees** customer phone/email/address, prices, payments, financial reports or margin. A workshop job view
  shows job number, product, specifications, dimensions, reference images, target date and stages. Delivery contact details
  are shown only on deliveries assigned to the user.
- **Finance does not get** customer-uploaded reference files or workshop private files unless they also hold another role
  (`files:view_customer_private` excludes Finance by design).
- **"own"** is enforced in the SQL query (`assigned_to = actor.id`), not only in the UI. Sales `payments:view` "own" means
  payments on orders the user created; `reports:sales` "own" means the user's own orders.
- **Discount limit**: Sales may discount up to `site_settings.sales_max_discount_percent` (default `0` until the owner sets it);
  anything above needs `quotations:discount_override` (Manager/Owner).
- **Cancelling after a payment exists** needs `orders:cancel_paid` (Manager/Owner); Sales can cancel unpaid orders.
- **Payments are never deleted.** A void creates a linked reversal record with reason and actor (audited).
- **Public (unauthenticated) visitors** may only: read published catalogue/gallery/settings, submit enquiry forms, and upload to
  the enquiry quarantine area. Nothing else.
- **Inactive profiles** have no permissions even with a valid session.
- **Always written to `audit_logs`**: user/role changes, settings changes, inventory adjustments, payment voids, price/discount
  overrides, cancelling a confirmed order, quotation status overrides, archival/deletion, and private-file access by non-owners.

## Test requirements

1. Matrix equality: this document ⇔ `permissions.ts` (unit test, runs in CI).
2. Owner holds every permission; inactive and role-less actors hold none.
3. Explicit "must never" assertions (e.g. Workshop has no payment/financial permission; Finance has no customer private files).
4. Every service entry point calls `requirePermission` first and is covered by a per-role test (added with each module).
5. Scoped access: a workshop user cannot read or update another worker's job (query-level test, Step 5).
6. DB-level: the `anon` and `authenticated` Postgres roles hold no privileges on any `public` table (integration test, in place).
