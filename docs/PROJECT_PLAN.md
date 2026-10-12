# Project Plan — Furniture Website + CRM + ERP-lite

Status: **Steps 0–6 complete (see README for known limitations); Step 7 (hardening and handover) is next.**
Deployment target (confirmed by the client): **Vercel**.

## 1. What exists today

Nothing. The repository (`rashad-77/paramount-exports`) is empty with no commits. Environment at the time of
planning: Node 22, npm 10, pnpm 10, Postgres 16 client tools, Docker CLI, Chromium for Playwright.

> The repository name suggests the working name "Paramount Exports". **This is not confirmed as the
> business name** and is not used in any customer-facing copy. The business name is a configurable
> setting (`site_settings.business_name`) with the clearly-marked placeholder `[Business Name]`.

## 2. Scope summary

One modular monolith (Next.js on Vercel + one PostgreSQL database) with three connected areas:

1. Public enquiry-led furniture website (no cart / checkout / online payment).
2. Internal CRM + sales (customers, leads, follow-ups, quotations, orders, payments).
3. Internal ERP-lite (inventory, workshop jobs, purchasing, deliveries, operational finance, after-sales).

Out of scope for v1 (documented as future phases in `ARCHITECTURE.md` §12): online checkout/payment, full
accounting, payroll, multi-branch beyond a non-blocking data model, automated WhatsApp API, barcode/QR, 3D/AR,
customer tracking portal, advanced production scheduling, native apps.

## 3. Defaults chosen (review these)

| # | Decision | Why |
|---|----------|-----|
| D1 | Next.js (App Router) + TypeScript strict + Tailwind CSS, deployed on **Vercel** | Client requirement + best fit |
| D2 | **Supabase** for Postgres, Auth and private Storage; app connects to Postgres via the Supabase **transaction pooler** (serverless-safe) | Spec recommendation; works with Vercel's Supabase integration |
| D3 | **Drizzle ORM** for typed queries; schema in TS; **SQL migrations** (generated + hand-written for triggers/RLS/constraints) | Typed, transaction + `FOR UPDATE` support, no heavy runtime |
| D4 | Authorization is enforced in a **server-side service layer** (`requirePermission`), with RLS enabled **deny-all** on every table as defence in depth | The app talks to Postgres directly; Supabase's public REST API must never expose data |
| D5 | Permission matrix lives in code (`src/lib/auth/permissions.ts`), role assignments in DB (`user_roles`) | Type-safe, testable, version-controlled |
| D6 | File uploads go **browser → private Supabase Storage via signed upload URL**; server validates metadata and records file rows. Files are read via short-lived signed URLs after a permission check | Vercel request bodies are capped (~4.5 MB) |
| D7 | Public-form rate limiting = Postgres-backed counters + honeypot + minimum-time check; optional Cloudflare Turnstile when keys are configured; Vercel Firewall rules recommended | No extra paid service required |
| D8 | Quotation "PDF" = print-friendly HTML route (browser Save-as-PDF). Server-rendered PDF is a later option | Headless Chromium on serverless is fragile |
| D9 | Timestamps stored as `timestamptz` (UTC); displayed in configurable timezone, default `Asia/Colombo` (**to confirm**) | Spec §14 |
| D10 | Currency configurable; default `LKR` (**to confirm**); money = `numeric(14,2)`, quantities = `numeric(14,3)`; app uses a decimal library, never JS floats | Spec §6/§10 |
| D11 | Document references: `SO-000123`, `QUO-…`, `JOB-…`, `PO-…` from Postgres sequences (collision-safe, not gapless) | Spec §6 |
| D12 | Vercel Cron for housekeeping (expire quotations, purge rate-limit rows) | Native to Vercel |
| D13 | Tests: Vitest (unit + DB integration against real Postgres), Playwright (smoke/e2e) | Concurrency tests need real Postgres |
| D14 | Package manager: **pnpm**, lockfile committed | Installed, fast, Vercel supports it |
| D15 | **TypeScript 5.9** (not 7.x) and **ESLint 10**; self-hosted fonts via `@fontsource` (Newsreader serif + Inter sans) | TS 7 is not yet supported by the lint plugins; fonts need no build-time network and no third-party requests |
| D16 | Brief's `stone` (#77776C) is 4.1:1 on ivory (fails AA for text): kept for borders/icons only; secondary text uses `#5E5E54` (5.9:1) | Accessibility; see `src/styles/tokens.css` |

## 4. Open business questions (assumptions marked)

| # | Question | Working assumption |
|---|----------|--------------------|
| Q1 | Real business name, logo, brand guidelines, photography? | Placeholder name/logo; palette from spec §15 |
| Q2 | Currency and timezone? | LKR, Asia/Colombo — **unconfirmed** |
| Q3 | Stock reservation policy for ready-made orders | Reserve on **Confirmed**; convert to a sale deduction on **Delivered**; release on **Cancelled** (implemented, tested) |
| Q4 | Who may record payments? | Sales, Finance, Manager, Owner can record; only Finance/Manager/Owner can void (void = reversing record, never delete) |
| Q5 | Discount authority | Sales may discount up to a configurable % (default 0 until set); beyond that Manager/Owner |
| Q6 | Deposit policy for custom orders | Free-form per order (amount/percentage set by staff); no default percentage |
| Q7 | Finished goods from custom jobs create stock? | Setting `custom_job_creates_finished_stock`, default **off** |
| Q8 | Are formal invoices needed? | Not in v1; "invoiced sales" metric is hidden until invoices are approved. Orders + payments only |
| Q9 | Is labour cost tracked (hours×rate or manual)? | Manual labour cost entries, optional, off by default |
| Q10 | Supplier payment status tracking? | Included at PO level (invoice ref, amount invoiced, amount paid) — no supplier ledger |
| Q11 | Languages for the public site (English / Sinhala / Tamil)? | English only; i18n-ready copy structure |
| Q12 | Public availability status shown? | Off by default per product (`show_availability`) |
| Q13 | Showroom address, hours, phone, WhatsApp number, domain | Editable settings; map hidden until a real address is entered |
| Q14 | Number of staff accounts and how users are invited | Owner invites users by email via Supabase Auth; no self sign-up |
| Q15 | Existing data to import (customers, stock)? | None assumed; CSV import is a later phase |

## 5. Ordered milestones

| Step | Content | Exit criteria |
|------|---------|---------------|
| 0 | Planning docs | These five docs exist |
| 1 | Foundation: app shell, design tokens + core components, auth, roles/permissions, DB + migrations, seed, error handling, scripts, README, `.env.example` | lint, typecheck, tests, build pass; migrations apply to clean DB; homepage + one dashboard screen reviewed in a real browser at desktop & mobile; permission matrix tested |
| 2 | Public website + enquiry forms wired to CRM; uploads; spam protection; SEO | Acceptance #1, #12 |
| 3 | CRM + quotations + print view | Acceptance #2, #3 (partial) |
| 4 | Products, locations, inventory ledger, reservations, ready-made orders, payments, transfers | Acceptance #4, #10, #11 |
| 5 | Workshop jobs, stage history, BOM/consumption, suppliers, POs, receipts | Acceptance #5–#9 |
| 6 | Deliveries, expenses, operational reports, exports, after-sales | Dashboards use defined metrics |
| 7 | Hardening: full acceptance + authz tests, a11y/perf pass, security review, backup/restore doc, handover | Acceptance #1–#14 |

## 6. Local commands (target; created in Step 1)

```bash
pnpm install
cp .env.example .env.local      # fill in Supabase values
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # dev/demo data only (refuses in production)
pnpm dev                        # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e                   # Playwright smoke tests
```

## 7. Vercel deployment notes

- Set all variables from `.env.example` in Vercel Project Settings (Production / Preview separately).
  `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are server-only — never prefix with `NEXT_PUBLIC_`.
- Use the Supabase **pooler** connection string (port 6543) as `DATABASE_URL`; a direct/session string
  (`DATABASE_DIRECT_URL`) is used only for running migrations from CI or a developer machine.
- Preview deployments must point at a **separate** Supabase project (or branch), never production data.
- Migrations are applied explicitly (`pnpm db:migrate`) — not automatically on every deploy.
