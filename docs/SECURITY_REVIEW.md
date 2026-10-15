# Security review (orders-only version)

A review by the developers of this code, not an independent penetration test. Each line says how it was checked.
"Tested" means an automated test in this repository exercises it; "reviewed" means read and reasoned about but not automated.
This replaces the earlier review, most of which covered modules that have since been removed.

## Access control

| Area | Finding | Evidence |
|---|---|---|
| Server-side authorization | Every staff service function takes an explicit actor and calls `requirePermission` first; hiding a button is cosmetic | Reviewed all of `src/server/*`; `orders.db.test.ts` checks every order, customer, dashboard and message function refuses a person with no role |
| Permission matrix | One table in code; the docs table is generated and a test fails if they drift; the owner holds every permission; two roles only (asserted) | Tested (`permissions.test.ts`) |
| Staff routes | The staff layout requires a signed-in active person; every staff Server Action goes through `runAction` and is never marked public; every API route checks the actor or a secret, or is on a reviewed public list | Tested (`route-guards.test.ts`); signed-out redirects tested in the browser (`smoke.spec.ts`) |
| Files | Private files (pictures sent with custom requests) are served through an authenticated route that checks the file's rules on every request; unknown entity types are denied | Tested (`canViewFile`, e2e "not downloadable by the public") |
| Deactivation | Roles and active status are read from our database on every request, never from tokens | Reviewed (`lib/auth/session.ts`); service-level denial of inactive actors tested |
| Last owner | Cannot be removed, demoted or deactivated, including under a race | Tested (`users.db.test.ts`) |

## Ordering

| Area | Finding | Evidence |
|---|---|---|
| Prices | The browser sends only variant ids and quantities. Names and prices are read from the database and copied onto the order; a price edited in the browser is ignored; hidden, unpublished, archived, inactive or unpriced items are refused | Tested (`orders.db.test.ts`, e2e "price tampered with in the browser") |
| No payment data | There is no payment form, gateway or card field; the checkout does not ask for or store card or bank details; "paid" can only be set by staff | Tested (e2e asserts no card inputs or payment iframes) |
| Abuse | Honeypot, signed time-stamped token, optional Turnstile, and rate limits per address and per phone number for orders and for messages | Tested (service limits, honeypot, too-fast, forged token) |
| Order integrity | Allowed status moves are enforced in the service under a row lock; a cancelled order needs a reason; a finished order cannot change; the database also refuses a cancelled order without a reason, a delivery without an address, and bad quantities or amounts | Tested |
| Audit | Placing, confirming, progressing, delivering, cancelling, changing the delivery charge, and marking paid or unpaid each write an audit entry | Tested |
| Confirmation page | Shows only what the visitor just entered (kept in their own tab) and the order number from the address; it reads no order data, so guessing `?ref=` reveals nothing | Reviewed |

## Database

| Area | Finding | Evidence |
|---|---|---|
| Row-level security | Every table has RLS enabled with no policies, and browser roles (`anon`, `authenticated`) have no table or function privileges. `enforce_rls()` runs at the end of every migration, including `0015` | Tested (foundation tests connect as those roles) |
| Immutability | The audit log is append-only (triggers including TRUNCATE) | Tested, including raw-SQL attempts |
| SQL injection | All queries are parameterised (Drizzle / tagged `sql`); search text has `%` and `_` escaped so a wildcard cannot match everything | Reviewed; tested for `%` |
| Destructive migration | `0015` drops the old CRM/ERP data; it was tested from a clean database and applied to a populated local one | Tested locally; **not** applied to any real database |

## Application

| Area | Finding | Evidence |
|---|---|---|
| Input validation | Every form action validates with Zod before calling a service; services re-check business rules | Reviewed; schema tests for checkout and enquiries |
| CSRF | Server Actions use Next.js's built-in origin checking; `form-action 'self'` and `frame-ancestors 'none'` are also sent | Reviewed |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and the safe subset of CSP | Reviewed (`next.config.ts`); e2e |
| Uploads | Direct-to-storage via signed URLs; type, size and magic bytes verified before a file is ever linked; public visitors only reach the enquiry purpose and are rate limited | Tested |
| Sign-in | One generic failure message; rate limited; fails closed if the limiter is unavailable; open redirects blocked | Reviewed. The limiter is tested on its own; its wiring into the login action is not covered by an automated test because that needs a live Supabase |
| Secrets | Service-role key only on the server and in scripts; the dev-only demo identity is refused on Vercel, in production builds and against non-local databases | Tested (`demo-guard`) |
| Local storage | The basket is in the visitor's own browser and holds no personal data | Reviewed |
| Error messages | Unexpected errors show a reference only; details stay in server logs | Reviewed |

## Not done / future work

- **Script-src Content-Security-Policy** needs per-request nonces with Next.js; only the safe directives are set today.
- **Two-factor sign-in** is a Supabase setting that was not enabled or tested here. Recommended for the Owner.
- **Real-project checks**: Supabase Auth, Storage buckets, `pnpm create-owner` / `create-user` and the Vercel cron have not been run against real services.
- **Independent review**: a third-party penetration test before launch is advisable, especially of the public order and upload paths.
- **Vercel Firewall** rate-limit rules in front of the in-app limits for volumetric abuse.
- **Malware scanning** of uploads (type, size and magic-byte checks only today).
- **Order confirmation by phone** is the control against fake orders: a placed order is only a request until staff confirm it with the customer.
