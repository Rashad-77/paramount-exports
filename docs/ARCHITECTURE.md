# Architecture

## 1. Shape

A **modular monolith**: one Next.js (App Router) application deployed on Vercel, one PostgreSQL database (Supabase).
No microservices. The UI never talks to the database directly.

```
Browser ──► Next.js (Vercel)
              ├─ (public)  website, basket, checkout, enquiry forms (Server Actions)
              ├─ app/      staff area: dashboard, orders, messages, customers, catalogue, website, users, settings
              └─ api/      cron + signed-upload endpoints + form token + health
                    │
                    ▼
           Service layer  (src/server/*)   ← authorization + validation + transactions
                    │
                    ▼
           Drizzle ► Postgres (Supabase pooler)      Supabase Auth (identity)   Supabase Storage (files)
```

## 2. Layering rules

1. **Routes and Server Actions are thin.** They parse input (Zod), resolve the actor, call a service, map errors to the UI (`runAction`).
2. **Services own the business rules.** Every staff function takes an explicit `actor` and calls `requirePermission(actor, "<resource>:<action>")`
   first. Services are the only code that writes to the database.
3. **No database access from client components.** The browser never holds a service-role key or a connection string.
4. **Transactions** wrap every multi-row operation (placing an order with its lines, a status change with its audit entry). Orders are
   locked with `SELECT … FOR UPDATE` while their status or payment flag changes.
5. **Audit:** every staff change to an order, message, user or setting writes `audit_logs` in the same transaction.
6. **Errors:** services throw typed `AppError`s (`FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `INVALID_STATE`, `RATE_LIMITED`).
   Unknown errors are logged with a reference and shown to people as a generic message.

## 3. Layout

```
src/
  app/
    (public)/        home, products, product page, cart, checkout, order/confirmed, custom, about, gallery, contact, legal
    (auth)/login
    app/             staff area (layout requires a signed-in, active person)
      orders/ messages/ customers/ products/ categories/ gallery/ website/ users/ settings/
    api/             cron/, uploads/, files/, form-token/, health/
  components/        ui/ (buttons, fields, tables), public/ (site chrome, cart, checkout, gallery), app/ (shell, forms)
  lib/               auth/ (session, permissions), db/ (client, schema/), cart.ts, order-constants.ts, money.ts, settings.ts …
  server/            orders.ts, messages.ts, catalogue.ts, catalogue-public.ts, files.ts, settings.ts, users.ts, audit.ts
drizzle/             SQL migrations (version controlled)
tests/               unit/, integration/ (real Postgres), e2e/ (Playwright)
```

## 4. Ordering without payment

1. **Basket** (`src/lib/cart.ts`): kept in the browser's `localStorage`, shared between tabs. It stores what is needed to display the
   basket. It is never trusted.
2. **Checkout** posts only variant ids and quantities (JSON), the customer's details and their choices.
3. **`placeOrder`** (`src/server/orders.ts`): checks the form token (anti-spam), rate limits per address and per phone, then reads each
   option from the database. It refuses anything unpublished, archived, inactive or without a public price. It computes the subtotal
   with decimal arithmetic and, in one transaction, inserts the order and its lines with the **name, option, SKU and price copied
   onto them**, and an audit entry.
4. **Confirmation page** shows the order number, and the bank details if the customer chose transfer. The summary comes from a copy the
   checkout kept in `sessionStorage`; the basket is emptied on that page.
5. **Staff** move the order on, agree the delivery charge (total = subtotal + charge) and record payment. There is no payment code in the system.

## 5. Authentication and authorization

- **Supabase Auth** (email + password) via `@supabase/ssr` cookies; the session cookie is refreshed in `src/proxy.ts`. Authorization never
  trusts the cookie alone: `getActor()` verifies the user, then loads active roles from `user_roles`. A deactivated profile is refused.
- No public sign-up: the Owner creates staff with `pnpm create-user`. Auth is behind `getActor()`, so tests inject actors directly.
- Two roles, `owner` and `staff` (`src/lib/auth/permissions.ts`; table in `docs/ROLE_PERMISSIONS.md`, generated and checked by a test).
- **RLS** is enabled on every public table with **no policies** for `anon`/`authenticated`; the app's server role bypasses it and relies on the
  service layer. A test asserts the API roles have no access.

## 6. Files

Private bucket `private-files` (pictures sent with custom requests) and public bucket `public-media` (catalogue and gallery images).
Uploads: the client asks `POST /api/uploads/sign`; the server checks permission (or the public enquiry context, with a rate limit), size and
content type, issues a signed URL, and later verifies the real bytes (magic numbers) before linking the file. Unlinked uploads are
purged by the daily cron. Private files open only through `/api/files/[id]` for staff.

## 7. Public forms and spam

Honeypot field, signed time-stamped token (not instant, not stale), optional Cloudflare Turnstile, and per-IP and per-phone rate limits
(IPs are stored only as salted hashes). Applies to enquiries and to orders.

## 8. Money, time

`numeric(14,2)` money; `decimal.js` in TypeScript with strings at the boundary. Timestamps are UTC `timestamptz`; display uses the
configured time zone (default `Asia/Colombo`, unconfirmed).

## 9. Observability

Structured logs with a reference on unexpected errors (Vercel logs); `/api/health` (no secrets); the audit log.
