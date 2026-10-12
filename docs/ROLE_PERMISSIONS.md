# Role & Permission Matrix

Least-privilege starting point. Users may hold several roles; effective permissions are the **union**.
Legend: ✓ full · **own** only records assigned to / created by the user · **R** read-only · — none.
This file is the source of truth for review; `src/lib/auth/permissions.ts` must match it (enforced by a test).

| Permission (`resource:action`) | Owner | Manager | Sales | Workshop | Finance |
|---|:-:|:-:|:-:|:-:|:-:|
| users:manage (invite, roles, deactivate) | ✓ | — | — | — | — |
| settings:manage (business details, currency, policies) | ✓ | — | — | — | — |
| settings:view | ✓ | ✓ | — | — | — |
| website:manage (catalogue publish, gallery, page content, opening hours) | ✓ | ✓ | — | — | — |
| audit:view | ✓ | R | — | — | — |
| customers:view | ✓ | ✓ | ✓ | — | R (names/contact for payments) |
| customers:write | ✓ | ✓ | ✓ | — | — |
| leads:view / write / assign | ✓ | ✓ | ✓ (assign: ✓) | — | — |
| followups:manage | ✓ | ✓ | ✓ (own + team view) | — | — |
| quotations:view | ✓ | ✓ | ✓ | — | R |
| quotations:write / send / convert | ✓ | ✓ | ✓ | — | — |
| quotations:discount (above Sales limit) | ✓ | ✓ | — | — | — |
| orders:view | ✓ | ✓ | ✓ | — | R |
| orders:write / confirm / cancel | ✓ | ✓ | ✓ (cancel after payment: Manager+) | — | — |
| payments:view | ✓ | ✓ | ✓ (own orders) | — | ✓ |
| payments:record | ✓ | ✓ | ✓ | — | ✓ |
| payments:void | ✓ | ✓ | — | — | ✓ |
| products:view | ✓ | ✓ | ✓ | R | R |
| products:write | ✓ | ✓ | — | — | — |
| inventory:view (finished goods) | ✓ | ✓ | ✓ | R | R |
| inventory:view_materials | ✓ | ✓ | — | ✓ | R |
| inventory:adjust (reason required, audited) | ✓ | ✓ | — | — | — |
| inventory:transfer | ✓ | ✓ | ✓ (showroom ↔ workshop requests) | ✓ | — |
| production:view | ✓ | ✓ | R (status only) | own | — |
| production:write (create/edit/assign jobs) | ✓ | ✓ | — | — | — |
| production:update_stage | ✓ | ✓ | — | own | — |
| production:record_materials (consumption, waste, issues) | ✓ | ✓ | — | own | — |
| production:view_costs (estimates, margin) | ✓ | ✓ | — | — | ✓ |
| suppliers:view / write | ✓ | ✓ | — | R | R |
| purchasing:write (PO create/send/cancel) | ✓ | ✓ | — | — | — |
| purchasing:receive (goods receipt) | ✓ | ✓ | — | ✓ | — |
| purchasing:record_payment | ✓ | ✓ | — | — | ✓ |
| deliveries:view | ✓ | ✓ | ✓ | own | R |
| deliveries:write / schedule | ✓ | ✓ | ✓ | — | — |
| deliveries:update_status | ✓ | ✓ | ✓ | own | — |
| aftersales:manage | ✓ | ✓ | ✓ | R | — |
| expenses:view | ✓ | ✓ | — | — | ✓ |
| expenses:write | ✓ | ✓ | — | — | ✓ |
| reports:sales | ✓ | ✓ | ✓ (own) | — | ✓ |
| reports:financial | ✓ | ✓ | — | — | ✓ |
| reports:operations (stock, production) | ✓ | ✓ | — | own jobs | — |
| files:view_customer_private (reference images, uploaded enquiry files) | ✓ | ✓ | ✓ | own jobs | **—** |
| files:view_finance (expense attachments) | ✓ | ✓ | — | — | ✓ |
| dashboard:owner | ✓ | ✓ | — | — | — |
| dashboard:sales / workshop / finance | per role | per role | sales | workshop | finance |

## Notes & assumptions

- **Workshop never sees**: customer phone/email/address, prices, payments, financial reports, margin. A workshop job view
  shows job number, product, specifications, dimensions, reference images, target date and stages. Delivery contact details
  are shown only on deliveries assigned to the user.
- **Finance does not get** customer-uploaded reference files or workshop private files unless they also hold another role.
- "own" is enforced in the SQL query (`assigned_to = actor.id` or team membership), not only in the UI.
- Public (unauthenticated) visitors may only: read published catalogue/gallery/settings, submit enquiry forms, and upload
  to the enquiry quarantine area. Nothing else.
- Discount limit for Sales is `site_settings.sales_max_discount_percent` (default `0` until the owner sets it).
- Payments are never deleted; a void creates a linked reversal record with reason and actor (audited).
- Sensitive actions always written to `audit_logs`: user/role changes, settings changes, inventory adjustments,
  payment void, price/discount overrides, order cancellation after confirmation, quotation status overrides, file access to private files by non-owners (sampled), deletions/archival.

## Test requirements

1. Matrix equality: documented table ⇔ `permissions.ts` (parsed in test).
2. For every role × permission, `can(actor, perm)` equals the matrix.
3. Every service entry point rejects an actor with no roles, an inactive actor, and a role lacking the permission.
4. Scoped access: a workshop user cannot read or update another worker's job (query-level).
5. DB-level: `anon` and `authenticated` Postgres roles can read/write nothing in `public`.
