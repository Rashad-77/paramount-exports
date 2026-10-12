# Security review (end of Step 7)

A review by the developers of this code, not an independent penetration test. Each line says how it was checked.
"Tested" means an automated test in this repository exercises it; "reviewed" means read and reasoned about but not automated.

## Access control

| Area | Finding | Evidence |
|---|---|---|
| Server-side authorization | Every service function takes an explicit actor and calls `requirePermission` first; the UI hiding a button is cosmetic | Reviewed all of `src/server/*`; each role's refusals tested per module (`*.db.test.ts`) |
| Permission matrix | One table in code; the docs table is generated and a test fails if they drift; owner holds every permission (asserted) | Tested (`permissions.test.ts`) |
| Scope "own" | Workshop sees only assigned jobs/deliveries and the files that belong to them; sales reports only their own orders | Tested (`workshop-purchasing`, `operations`) |
| Data minimisation | Workshop gets no customer name, prices, costs or payments (stripped in the service, not the page); purchase costs hidden from workshop; stock cost column hidden in exports | Tested |
| Files | Private files are served through an authenticated route that checks the entity's rules on every request; unknown entity types are denied; downloads are audited (except the owner's) | Tested (`canViewFile` cases) |
| Deactivation | Roles and active status are read from our database on every request, never from tokens | Reviewed (`lib/auth/session.ts`); service-level denial of inactive actors tested |
| Last owner | Cannot be removed, demoted or deactivated, including under a race | Tested (`users.db.test.ts`) |

## Database

| Area | Finding | Evidence |
|---|---|---|
| Row-level security | Every table has RLS enabled with no policies, and browser roles (`anon`, `authenticated`) have no table or function privileges. `enforce_rls()` runs at the end of every migration, so new tables cannot be forgotten | Tested (foundation tests connect as those roles) |
| Immutability | Audit log, stock ledger, payments, stage/delivery/case history, goods receipts, supplier payments are append-only (triggers incl. TRUNCATE); expenses can only be voided; sent quotation revisions, confirmed order lines, sent PO lines are frozen | Tested, including raw-SQL attempts |
| Money and stock integrity | Decimal arithmetic only; non-negative balance and reserved ≤ on-hand are CHECK constraints; stock changes go through one function with deterministic lock order | Tested, incl. concurrent confirmations, receipts, deliveries, payments |
| SQL injection | All queries are parameterised (Drizzle / tagged `sql`); the few `sql.raw` uses take only constants or identifiers derived from schema objects | Reviewed |
| Correlated sub-selects | Found and fixed: unqualified outer ids silently produced wrong counts; now qualified via `outer()` | Tested (regression) |

## Application

| Area | Finding | Evidence |
|---|---|---|
| Input validation | Every form action validates with Zod before calling a service; services re-check business rules | Reviewed; per-schema tests for key forms |
| CSRF | Server Actions use Next.js's built-in origin checking; `form-action 'self'` and `frame-ancestors 'none'` are also sent | Reviewed |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and the safe subset of CSP | Reviewed (`next.config.ts`); health endpoint e2e |
| Uploads | Direct-to-storage via signed URLs; type, size and magic bytes verified before a file is ever linked; unverified files are purged; public visitors only reach the enquiry purpose and are rate limited | Tested |
| Spam and abuse | Honeypot, signed time-stamped form token (instant submits refused), optional Turnstile, DB-backed rate limits per IP and per phone | Tested |
| Sign-in | One generic failure message; limited to 8 attempts per address and 30 per IP per 10 minutes; fails closed if the limiter is unavailable; open redirects blocked | Reviewed. **The limiter is generic and tested; its wiring into the login action is not covered by an automated test** because that needs a live Supabase |
| Exports | CSV exports check permission per export, are written to the audit log, and neutralise spreadsheet formulas | Tested |
| Secrets | Service-role key only on the server and in scripts; `.env.example` holds placeholders; the dev-only demo identity is refused on Vercel, in production builds and against non-local databases | Tested (`demo-guard`) |
| Dependencies | `pnpm audit --prod` reported no known vulnerabilities at the time of writing | Run |
| Error messages | Unexpected errors show a reference only; details stay in server logs | Reviewed |

## Not done / future work

- **Script-src Content-Security-Policy** needs per-request nonces with Next.js; only the safe directives are set today.
- **Two-factor sign-in** is a Supabase setting that was not enabled or tested here. Recommended for Owner and Finance.
- **Real-project checks**: Supabase Auth, Storage policies/buckets, `pnpm create-owner` / `create-user` and the Vercel cron have not been run against real services.
- **Independent review**: a third-party penetration test before launch is advisable, especially of the public upload path.
- **Vercel Firewall** rate-limit rules in front of the in-app limits for volumetric abuse.
- **Malware scanning** of uploads (type/size/magic-byte checks only today).
