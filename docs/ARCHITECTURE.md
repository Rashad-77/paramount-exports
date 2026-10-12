# Architecture

## 1. Shape

A **modular monolith**: one Next.js (App Router) application deployed on Vercel, one PostgreSQL database (Supabase).
No microservices. Modules are folders with clear boundaries; the UI never talks to the database directly.

```
Browser ──► Next.js (Vercel)
              ├─ (public)  server components, enquiry Server Actions
              ├─ (app)     authenticated internal app (CRM / ERP)
              └─ api/      cron + signed-upload endpoints
                    │
                    ▼
           Service layer  (src/server/<module>)   ← authorization + validation + transactions
                    │
                    ▼
           Drizzle ► Postgres (Supabase pooler)        Supabase Auth (identity)   Supabase Storage (private files)
```

## 2. Layering rules

1. **Routes / Server Actions are thin.** They parse input (Zod), resolve the actor, call a service, map errors to UI.
2. **Services own business rules.** Every service function takes an explicit `actor` and calls
   `requirePermission(actor, "<resource>:<action>")` first. Services are the only code that writes to the DB.
3. **No DB access from client components.** The browser never holds a service-role key or a DB string.
4. **Transactions** wrap every multi-row business operation (order confirm, stock reserve, payment, transfer,
   goods receipt, consumption, quotation conversion). Stock rows are locked with `SELECT … FOR UPDATE` in a
   deterministic order (by `item_id, location_id`) to avoid deadlocks.
5. **Audit**: sensitive services call `audit.record(tx, {...})` inside the same transaction as the change.
6. **Errors**: services throw typed `AppError`s (`Forbidden`, `NotFound`, `Validation`, `Conflict`,
   `InsufficientStock` …). Unknown errors are logged server-side with a request id and shown to users as a generic message.

## 3. Proposed structure

```
.
├─ docs/                       planning + handover docs
├─ drizzle/                    SQL migrations (generated + custom) — version controlled
├─ scripts/                    migrate, seed, create-owner CLI
├─ src/
│  ├─ app/
│  │  ├─ (public)/             home, products, custom, about, gallery, contact, legal
│  │  ├─ (auth)/login …
│  │  ├─ (app)/app/…           internal app (layout enforces login + role-filtered nav)
│  │  ├─ api/                  cron/, uploads/
│  │  ├─ sitemap.ts  robots.ts
│  │  └─ error.tsx  not-found.tsx  global-error.tsx
│  ├─ components/
│  │  ├─ ui/                   Button, Input, Select, Table, Dialog, Alert, StatusBadge, EmptyState …
│  │  ├─ public/               site header/footer, hero, product card …
│  │  └─ app/                  app shell, sidebar, page header, filters, pagination
│  ├─ lib/
│  │  ├─ auth/                 session, permissions matrix, requirePermission
│  │  ├─ db/                   client, schema/*.ts, tx helper
│  │  ├─ money.ts  quantity.ts decimal helpers (decimal.js)
│  │  ├─ env.ts                Zod-validated environment
│  │  ├─ errors.ts  logger.ts  request-id, AppError
│  │  ├─ rate-limit.ts  storage.ts  settings.ts  time.ts
│  ├─ server/                  services per module: crm, quotations, sales, inventory,
│  │                           production, purchasing, finance, delivery, aftersales, files, audit
│  └─ styles/tokens.css        design tokens
├─ tests/                      unit/, integration/ (real Postgres), e2e/ (Playwright)
└─ .env.example  README.md  vercel.json
```

## 4. Authentication & sessions

- **Supabase Auth** (email + password; optional magic link) via `@supabase/ssr` cookies.
- Middleware refreshes the session cookie. **Authorization never trusts the cookie alone**: server code calls
  `supabase.auth.getUser()` (verified against Auth server) and then loads the user's active roles from
  `user_roles`. A deactivated profile (`profiles.is_active = false`) is rejected even with a valid session.
- No public sign-up: Owner invites staff. Initial Owner is created with `pnpm create-owner` (service-role key, run locally only).
- Auth is hidden behind `getActor()`; tests inject actors directly, so business logic is testable without Supabase.

## 5. Authorization (server-enforced)

- Roles: `owner`, `manager`, `sales`, `workshop`, `finance`. Users can hold several; permissions are the **union**.
- Permissions are strings `resource:action`. The matrix is in `docs/ROLE_PERMISSIONS.md` and implemented in
  `src/lib/auth/permissions.ts`. A test asserts that the code matrix equals the documented matrix and that
  every service function declares a permission.
- "Scoped" permissions (e.g. workshop sees only **assigned** jobs) are enforced in the query (`WHERE assigned_to = actor`),
  not only after fetching.
- UI hides inaccessible navigation, but the server is authoritative.
- **RLS**: enabled on every table in `public` with **no policies** for `anon`/`authenticated` — Supabase's auto-generated
  REST API therefore returns nothing. The app's server-side DB role bypasses RLS and relies on the service layer.
  A test connects as `anon`/`authenticated` roles and asserts zero access. (If client-side Supabase reads are ever
  introduced, explicit policies and tests must be added first.)

## 6. Files

- Private bucket `private-files` (customer reference images, expense attachments, delivery proofs) and public bucket
  `public-media` (catalogue/gallery images chosen for publication).
- Upload flow: client requests `POST /api/uploads/sign` with declared name/type/size → server checks permission or
  public-form context, size ≤ limit, content-type allow-list (jpeg, png, webp; pdf for attachments), generates a
  random object key, returns a signed upload URL → client uploads directly → client calls the form action with the
  object key → server verifies the object exists, re-checks size/type from Storage metadata, writes `uploaded_files`.
- Public-form uploads are accepted into a quarantine prefix, linked only when the enquiry is saved; orphans are purged by cron.
- Reads: server checks permission then returns a signed URL valid for minutes. No public listing of the private bucket.

## 7. Public enquiry pipeline

`form → Server Action → Zod validation → honeypot + min-fill-time + optional Turnstile → DB rate limit (per IP hash and per phone/email)
→ transaction: find-or-warn customer by normalised phone/email, create customer if none, create lead (+ product context) → attach files → audit/activity`.
Duplicates are **flagged** on the lead (`possible_duplicate_of`) — never merged silently. IPs are stored as salted hashes only.

## 8. Inventory model (core idea)

Single immutable **ledger** `inventory_movements`; each row carries `on_hand_delta` and `reserved_delta`.
`inventory_balances(item, location)` is a transactional cache updated in the same transaction (with `CHECK on_hand >= 0`,
`reserved >= 0`, `reserved <= on_hand`). Available = on_hand − reserved. Movements are never updated or deleted
(DB trigger blocks it); corrections are new movements. A reconciliation query/test proves `balance = Σ movements`.

## 9. Money & numbers

`numeric(14,2)` money, `numeric(14,3)` quantity. TypeScript uses `decimal.js` (strings at the boundary). Totals are
computed in one place (`lib/money.ts`) and re-validated server-side; client-supplied totals are never trusted.

## 10. Time

Stored UTC `timestamptz`; date-only business fields use `date`. Display and date-range report boundaries use the
configured timezone (`site_settings.timezone`).

## 11. Observability & reliability

Structured JSON logs with request id; Vercel logs. Backups: Supabase daily backups (plan-dependent) + documented
`pg_dump` procedure and restore drill (`docs/OPERATIONS.md`, Step 7). Health endpoint `/api/health` (no secrets).

## 12. Future phases (not built; not to be added quietly)

Online checkout/payments; accounting (double-entry, tax, bank reconciliation); payroll/attendance; multi-branch;
WhatsApp Business API; barcode/QR; 3D/AR; customer tracking portal; production scheduling/capacity; native apps;
server-rendered PDFs; CSV import; notification providers.
