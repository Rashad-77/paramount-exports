# Paramount Export Industries: website and online orders

One Next.js application (deployed on **Vercel**) and one PostgreSQL database (**Supabase**) for a wood-furniture business:
a public website where customers browse, **order online without paying online**, or send an enquiry, and a small staff area
for handling those orders.

> **Status:** the CRM and ERP modules have been removed and replaced with online orders (see `docs/PROJECT_PLAN.md`).
> Read `docs/KNOWN_LIMITATIONS.md` first: Supabase, Storage, Vercel and GitHub CI have not been exercised against real services.

## What it does

**For customers (public website)**

- Browse the collection, product pages with photographs, options and prices.
- **Add pieces to an order, check out, and get an order number.** There is **no online payment**: the customer chooses delivery
  or showroom collection, and how they plan to pay (on delivery, bank transfer, or at the showroom). Staff confirm the order.
- **Optional customer accounts** (off until the owner turns them on in Settings): order history, quotation requests, saved details and
  address, a basket that follows them between devices, password change and account deletion. Guests can always order and track an order
  with its number and phone number. See "Customer accounts" below.
- Contact page (contacts, address, map, enquiry form), custom-furniture request form, gallery (video hero, filters, viewer), About, legal pages.

**For staff (`/app`, two roles: Owner and Staff)**

- **Dashboard:** new and open orders, messages to answer, 30-day totals, orders per day.
- **Orders:** list with status tabs and search; each order shows the customer, items, delivery or pickup, how they plan to pay.
  Staff confirm, move it to *in progress* and *delivered* (or cancel with a reason), agree the **delivery charge** (the total updates),
  add a staff note, and **record payment** once the money arrives offline. Every change is audited.
- **Messages:** contact-form messages, product enquiries and custom-furniture requests (with pictures), marked handled when answered.
- **Customers:** built from orders (grouped by phone number), with order history.
- **Products and categories, gallery, website page wording, users, settings** (business details, opening hours, bank details for transfers).

## Documentation

| Doc | What it is |
|---|---|
| `docs/PROJECT_PLAN.md` | what the system is, what changed, decisions |
| `docs/ARCHITECTURE.md` · `docs/DATA_MODEL.md` | how it is built and what is stored |
| `docs/ROLE_PERMISSIONS.md` | who can do what (generated from code) |
| `docs/ACCEPTANCE_TESTS.md` | the flows that must work, and the automated test behind each |
| `docs/DEMO_DEPLOYMENT.md` | a password-less sample-data demo on Vercel alone (no Supabase) |
| `docs/OPERATIONS.md` | setup, releasing, backup and restore, troubleshooting |
| `docs/SECURITY_REVIEW.md` · `docs/KNOWN_LIMITATIONS.md` | what was checked, what was not |
| `docs/DESIGN_NOTES.md` | the visual system |

## Requirements

Node 22+, pnpm 10+, a Supabase project (for sign-in and the real database), and for tests a throwaway local PostgreSQL 16.

## First-time setup

```bash
pnpm install
cp .env.example .env.local        # fill in the Supabase values (see comments in the file)
pnpm db:migrate                   # applies ./drizzle migrations (uses DATABASE_DIRECT_URL)
pnpm storage:setup                # creates the two Supabase Storage buckets with size/type limits
OWNER_PASSWORD='a long passphrase' pnpm create-owner --email you@example.com --name "Your Name"
# later, for staff:  OWNER_PASSWORD='one-off password' pnpm create-user --email sam@example.com --name Sam --role staff
pnpm dev                          # http://localhost:3000  (staff sign-in at /login)
```

Without any environment variables the **public site still runs** (with placeholder content, and without ordering, which needs the database).

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Run / build / serve the app |
| `pnpm lint` · `pnpm typecheck` | ESLint · `tsc --noEmit` (strict) |
| `pnpm test` | Unit tests + database integration tests (integration tests need `TEST_ADMIN_DATABASE_URL`, otherwise they are **skipped**) |
| `pnpm test:e2e` | Playwright browser tests against the production build (`pnpm build` first): ordering, enquiries, access control, accessibility |
| `pnpm db:generate` | Generate a SQL migration from schema changes (`pnpm drizzle-kit generate --custom --name x` for hand-written SQL) |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | **Sample** data for local development (everything labelled `[Sample]`: products, a gallery project, messages, orders). Needs `DEMO_MODE=true` and a localhost `DATABASE_URL`; refuses otherwise |
| `pnpm docs:permissions` | Regenerate the permission table in `docs/ROLE_PERMISSIONS.md` from code |

### Running the tests

They need a **throwaway** Postgres superuser connection (each run creates and drops its own database). Never use Supabase here.

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16     # or any local PostgreSQL 16
export TEST_ADMIN_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
pnpm test
pnpm build && pnpm test:e2e
```

To build for the browser tests while `pnpm dev` is running, give the build its own folder: set `NEXT_DIST_DIR=.next-e2e` for both `pnpm build` and `pnpm test:e2e` (PowerShell: `$env:NEXT_DIST_DIR=".next-e2e"`). Without it, both use `.next`, which a running dev server holds open.

`pnpm build` pre-renders some pages, so when you run the browser tests locally build with `DATABASE_URL` pointing at the
throwaway `e2e_furniture` database (or with no `.env.local`), otherwise the built pages carry your development data.

### Trying the staff screens locally (no Supabase)

With a **local** Postgres and `.env.local` containing

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
DEMO_MODE=true
STORAGE_DRIVER=local
IP_HASH_SALT=local-salt-local-salt-1234
```

run `pnpm db:migrate && pnpm db:seed && pnpm dev`, then open `/dev/demo-role?role=owner` (or `staff`) to sign in as a sample user.
This identity exists **only** under `next dev`, never on Vercel or in a production build, and only against a localhost database
(unit-tested). The sign-in stub the database needs: `create schema auth; create table auth.users(id uuid primary key, email text);`.

> **Project in OneDrive?** OneDrive rewrites files in `.next`, which can make `pnpm dev` recompile in a loop and the pages flicker.
> Keep the project outside OneDrive (for example `C:\dev\paramount`).

### Customer accounts

Customers are **not staff**: an account never grants access to `/app` (that needs a staff profile and a role).

- **Off by default.** Settings, "Customer accounts", has: turn accounts on, allow new sign-ups, require an account to order, keep the basket on the
  account. It **cannot be switched on** until a sign-in service is connected, so the site never offers a sign-in that cannot work.
- **Sign-in service:** the same Supabase project as staff sign-in (email and password). In that project: allow email sign-up, set up the
  confirmation and password-reset emails, and add `<site address>/account/confirm` to the allowed redirect URLs. To also delete the
  sign-in identity when a customer deletes their account, set `SUPABASE_SERVICE_ROLE_KEY` (otherwise only the account data is removed).
- **Not yet verified against a real Supabase project.** The real path is written but could only be tested here with a built-in stand-in
  (the browser tests set `ALLOW_LOCAL_CUSTOMER_AUTH=e2e-only`; `pnpm dev` with `DEMO_MODE=true` uses it too). Neither exists on Vercel.
  Test sign-up, confirmation, sign-in and reset once against the real project before switching accounts on.
- **Privacy:** a customer sees only orders linked to their account (filtered in the database query by the verified session). Orders are linked only
  when placed while signed in, or when the customer adds one with its number and the phone number it was placed with (same proof and rate limits
  as the public tracking page). Orders are never linked automatically by phone number.

## Deploying to Vercel

1. Import the repository in Vercel (framework preset: Next.js; `vercel.json` sets pnpm install/build).
2. Add every variable from `.env.example` (Production and Preview separately). Use the Supabase **transaction pooler**
   string for `DATABASE_URL`. `SUPABASE_SERVICE_ROLE_KEY` is server-only: never expose it to the browser.
3. Point **Preview** deployments at a separate Supabase project; never share production data with previews.
4. Run `pnpm db:migrate` against production explicitly (migrations are not run on every deploy). **Migration `0015` is destructive:**
   it drops the old CRM/ERP tables and their data (see `docs/PROJECT_PLAN.md`). Take a backup first.
5. Create the first Owner with `pnpm create-owner` from a trusted machine.
6. Choose the Vercel function region closest to the Supabase region to keep database latency low.

## Conventions that matter

- **Authorization is server-side.** Every service function starts with `requirePermission(actor, "resource:action")`.
  Hiding UI is cosmetic. The matrix lives in `src/lib/auth/permissions.ts`.
- **Prices come from the database, never the browser.** The basket holds ids and quantities; `placeOrder` reads names and prices
  and copies them onto the order, so later catalogue edits never change an order.
- **Every new table must enable RLS** (deny-all) in its migration (`SELECT enforce_rls();`): a test fails otherwise.
- **Money is decimal** (`src/lib/money.ts`, `numeric` columns). Never use JS floats for business maths.
- **The audit log is append-only.** Correct with new rows, never edits.
- **No invented content.** Names, photos, prices and contact details are placeholders until the client supplies them.
