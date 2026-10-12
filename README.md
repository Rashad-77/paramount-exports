# Furniture Platform — website + CRM + ERP-lite

One Next.js application (deployed on **Vercel**) and one PostgreSQL database (**Supabase**) for a wood-furniture
business: an enquiry-led public website, an internal CRM/sales area, and ERP-lite inventory, workshop, purchasing,
delivery and operational finance. See `docs/` for the plan, architecture, data model, permission matrix and acceptance tests.

> **Status: Step 1 (foundation) complete.** Built so far: design system, public homepage (placeholder content), staff
> sign-in, role/permission model, database foundation, app shell + overview. Modules (CRM, inventory, workshop…) arrive in
> Steps 2–6 — see `docs/PROJECT_PLAN.md`. Business name, photos and contact details are **placeholders** until supplied.

## Requirements

Node 22+, pnpm 10+, a Supabase project (for sign-in and the real database), and for tests a throwaway local PostgreSQL 16.

## First-time setup

```bash
pnpm install
cp .env.example .env.local        # fill in the Supabase values (see comments in the file)
pnpm db:migrate                   # applies ./drizzle migrations (uses DATABASE_DIRECT_URL)
OWNER_PASSWORD='a long passphrase' pnpm create-owner --email you@example.com --name "Your Name"
pnpm dev                          # http://localhost:3000  (staff sign-in at /login)
```

Without any environment variables the **public site still runs** (with placeholder content); `/app` redirects to `/login`.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run / build / serve the app |
| `pnpm lint` · `pnpm typecheck` | ESLint · `tsc --noEmit` (strict) |
| `pnpm test` | Unit tests + database integration tests (integration tests need `TEST_ADMIN_DATABASE_URL`, otherwise they are **skipped**) |
| `pnpm test:e2e` | Playwright smoke + accessibility tests against the production build (`pnpm build` first) |
| `pnpm db:generate` | Generate a SQL migration from schema changes (`pnpm drizzle-kit generate --custom --name x` for hand-written SQL) |
| `pnpm db:migrate` | Apply migrations |
| `pnpm docs:permissions` | Regenerate the permission table in `docs/ROLE_PERMISSIONS.md` from code |
| `pnpm tsx scripts/screenshots.ts <dir>` | Screenshot pages at desktop + phone sizes for visual review |

### Running the integration tests

They need a **throwaway** Postgres superuser connection (each run creates and drops its own database). Never use Supabase here.

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
export TEST_ADMIN_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
pnpm test
```

### Visual review without Supabase

`DEMO_MODE=true pnpm dev`, then open `/dev/preview/app?role=owner|manager|sales|workshop|finance`. This shows the internal
dashboard with **sample** data and a **sample** user. It returns 404 in production builds.

## Deploying to Vercel

1. Import the repository in Vercel (framework preset: Next.js; `vercel.json` sets pnpm install/build).
2. Add every variable from `.env.example` (Production and Preview separately). Use the Supabase **transaction pooler**
   string for `DATABASE_URL`. `SUPABASE_SERVICE_ROLE_KEY` is server-only — never expose it to the browser.
3. Point **Preview** deployments at a separate Supabase project; never share production data with previews.
4. Run `pnpm db:migrate` against production explicitly (migrations are not run on every deploy).
5. Create the first Owner with `pnpm create-owner` from a trusted machine.
6. Choose the Vercel function region closest to the Supabase region to keep database latency low.

## Conventions that matter

- **Authorization is server-side.** Every service function starts with `requirePermission(actor, "resource:action")`.
  Hiding UI is cosmetic. The matrix lives in `src/lib/auth/permissions.ts`.
- **Every new table must enable RLS** (deny-all) in its migration — a test fails otherwise. The app reaches Postgres directly
  through the service layer; Supabase's public API must expose nothing.
- **Money and quantities are decimals** (`src/lib/money.ts`, `numeric` columns). Never use JS floats for business maths.
- **Ledgers are append-only** (audit log now; stock movements in Step 4). Correct with new rows, never edits.
- **No dead UI.** Navigation only lists built pages (`available` flag in `src/lib/nav.ts`).
- **No invented content.** Names, photos, prices and contact details are placeholders until the client supplies them.

## Known limitations (Step 1)

- The Supabase sign-in flow and `create-owner` are written but have **not yet been exercised against a real Supabase
  project** (none is available in the build environment). Permission logic, DB layer and route protection are tested.
- CI workflow (`.github/workflows/ci.yml`) is written but has not run on GitHub yet.
- Currency (LKR) and timezone (Asia/Colombo) are unconfirmed assumptions.
