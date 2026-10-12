# Known limitations, assumptions and future phases

Honest list of what is and is not finished. Nothing here is hidden behind a feature that looks complete.

## 1. Not verified against real services

The build was developed and tested against a local PostgreSQL 16 with a stub of Supabase's `auth` schema. These have **not** been run
against a real Supabase project or Vercel deployment:

- Supabase sign-in/sign-out and session refresh (`/login`, `proxy.ts`), including multi-factor.
- Supabase Storage uploads and downloads (`pnpm storage:setup`, signed uploads, signed downloads). The local-disk driver is what the tests use.
- `pnpm create-owner` / `pnpm create-user` (they call the Supabase admin API).
- Vercel Cron, the Vercel build, and the GitHub Actions workflow (it has never run on GitHub).
- Cloudflare Turnstile (optional; disabled unless keys are set).

Do a rehearsal deployment with test data first (`docs/OPERATIONS.md`).

## 2. Assumptions to confirm with the owner

These were chosen because the brief did not say. Each is a setting or a small code change, not a redesign.

| Assumption | Where |
|---|---|
| Currency **LKR**, time zone **Asia/Colombo**, phone country code **94** | Business settings (shown on the dashboard until confirmed) |
| Stock is **reserved when an order is confirmed** and **deducted when it is delivered**; cancelling releases it | `src/server/orders.ts`, `inventory.ts` |
| **No invoices** in v1 — orders, payments and quotations only; reports say "invoiced: not available" | Reports |
| Sales staff's maximum discount defaults to **0%** until the owner sets it | Settings |
| A quotation that mixes ready-made and custom items cannot be converted to one order — split it into two | Orders |
| Finished-goods stock for custom pieces and labour-cost tracking are **off** until switched on | Settings → Workshop |
| A delivery's "fee" is informational; the amount charged is the order's delivery charge | Deliveries |
| Marking a delivery delivered also delivers its order (and deducts stock); an order can also be marked delivered by hand | Deliveries, Orders |
| A workshop job is created automatically when a custom order is confirmed; production never changes the order status by itself | Production |
| Expense categories start with a short generic list (editable) | Expenses |

## 3. Deliberate limits of this version

- **Materials**: consumption is recorded per job. A mistaken consumption record is corrected by a manager's stock adjustment (records are append-only); there is no "edit consumption". There are **no product-level bills of materials** — each job has its own material plan.
- **Costing** is an *estimate* from the costs entered; it lists items with no cost and never presents itself as audited profit. Operational "net cash movement" is not profit.
- **Notifications** (email/SMS/WhatsApp) are not implemented; follow-ups and overdue lists are on screen only.
- **Invites**: people are created by the owner with a script, not through the app (no invite email, no password-reset screen beyond what Supabase offers).
- **Quotation PDFs** use the browser's print view; there is no server-side PDF.
- **Search** uses simple case-insensitive matching on the main fields; there is no full-text search.
- **Reports** are fixed screens plus five CSV exports (orders, payments, expenses, stock, jobs); there is no report builder.
- **Performance**: fine for a small business's volumes (single-region, indexed lists, paginated tables). Large-volume tuning (full-text indexes, materialised report tables) has not been needed or done. Public pages ship about 500 kB of JavaScript uncompressed (about a third of that over the wire), measured once on a production build.
- **Accessibility**: automated axe checks (WCAG 2.1 A/AA) pass on the public pages and on all new staff pages for each role at desktop and phone width; keyboard and screen-reader testing was done only through the markup (labels, roles, focus order), not with assistive technology.
- **Languages**: English only. Sinhala/Tamil would need translated content and layout checks.

## 4. Out of scope (as per the brief) — not added

Online checkout and card payments, a payment gateway, full accounting (ledgers, tax returns, bank reconciliation), payroll,
WhatsApp/SMS API integration, barcode scanning, accounts-receivable ageing, a customer portal, multi-currency, multi-branch consolidation.

## 5. Suggested next phases

1. Rehearsal deployment and the real-service checks in §1; enable two-factor for Owner/Finance.
2. Owner review of every assumption in §2 and of the printed quotation wording.
3. Invoices (numbering rules, tax) once the accountant confirms requirements; then receivables ageing.
4. Notifications for follow-ups, quotations nearing expiry and delivery reminders.
5. Product-level bills of materials once enough jobs exist to know the standard recipes.
6. Customer-facing order-status page (read-only) if customers ask for it.
