# Acceptance Tests

Status key: ☐ not started · ◐ partial · ☑ passing (automated). Updated at the end of each step; nothing is ticked without a passing test.

| # | Flow | Test level | Step | Status |
|---|------|-----------|------|--------|
| 1 | Visitor submits custom enquiry with valid details + image → appears in CRM, assignee can view | integration + e2e | 2 | ☑ `enquiries.db.test.ts` (service → leads list/detail as the assigned user, file linked privately) and Playwright `public-site.spec.ts` (real browser upload + DB check). Staff *screen* viewing is covered by the service test; it needs Supabase sign-in to e2e |
| 2 | Staff create customer, lead, follow-up task and quotation | integration | 3 | ☑ `crm.db.test.ts` (ACCEPTANCE #2): exact decimal totals, specs, follow-up, link to enquiry. Also covered: discount limit, revisions, immutability (incl. raw-SQL attempts), concurrent send, expiry |
| 3 | Accepted quotation → order, preserving customer and line items (no duplication) | integration | 3/4 | ☑ `inventory-orders.db.test.ts`: lines, prices, totals, customer and revision link preserved; one order per quotation even under a race; mixed ready-made/custom is refused with a clear message |
| 4 | Ready-made order reserves/deducts stock once; concurrent orders can't oversell | integration (real Postgres, parallel tx) | 4 | ☑ `inventory-orders.db.test.ts`: ten simultaneous confirmations for 3 units → exactly 3 succeed; opposite-order multi-line orders never deadlock; reserve at confirm, deduct once at delivery, release once on cancel; balances always reconcile to the ledger |
| 5 | Custom order creates production job with specs + reference images | integration | 5 | ☑ `workshop-purchasing.db.test.ts` (ACCEPTANCE #5): one job per confirmed custom order, specification and quotation reference files copied, duplicate job impossible |
| 6 | Workshop updates assigned job stage; unauthorized roles blocked from finance data | integration + authz matrix | 1 (matrix), 5 | ☑ permission-matrix unit tests + `workshop-purchasing.db.test.ts`: workshop sees/updates only assigned jobs and files, never customer name, prices, costs, payments or orders; sales see stage only; finance cannot open jobs |
| 7 | Timber receipt increases stock only by quantity actually received (partial receipts) | integration | 5 | ☑ two-part receipt; over-receipt refused; five simultaneous receipts can never exceed the ordered quantity; sent lines locked (also at DB level); supplier invoice/payments capped and append-only |
| 8 | Material consumption decreases stock once, linked to correct job | integration | 5 | ☑ used + wasted movements reference the job; repeated and simultaneous submissions with the same key deduct once; shortage records nothing; unassigned workers refused |
| 9 | Job completion records status; optional finished-goods movement without duplicates | integration | 5 | ☑ default: status only, delivery moves no stock; with the setting on: output added once even after rework, removed once on delivery; cancelling the order cancels the job |
| 10 | Payments update outstanding balance with decimal arithmetic | unit + integration | 4 | ☑ `money.test.ts` + `inventory-orders.db.test.ts`: exact decimals, overpayment refused, voids as linked negative rows, concurrent payments serialised |
| 11 | Showroom ↔ workshop transfer records both sides atomically | integration | 4 | ☑ paired movements share the transfer id; a transfer short on any line leaves no trace at all |
| 12 | Public visitors cannot access internal customers/orders/suppliers/files (app + DB roles) | integration + e2e | 1 (DB roles), 2 | ◐ DB-role table + function denial, `/app` redirect, private-file download 404, staff upload purposes closed to anonymous: all tested. Orders/suppliers/customers routes arrive with their modules |
| 13 | Key forms show understandable validation/error messages | e2e + unit (schemas) | 2–6 | ◐ enquiry, login, catalogue, settings, customer (duplicate warning), quotation (per-line messages) covered; sales/workshop forms follow |
| 14 | App builds; migrations apply to clean DB; tests pass | CI | every step | ◐ verified locally at end of Step 1 (build, migrations on a clean DB, 56 unit/integration + 16 e2e); GitHub CI not yet run |

## Cross-cutting automated checks

- **Money/decimal**: `0.1 + 0.2` style cases, rounding rule, totals recomputed on server.
- **Ledger**: `balance = Σ movements` reconciliation after randomised sequences of operations.
- **Immutability**: UPDATE/DELETE on `inventory_movements`, `audit_logs` fails.
- **RLS**: connecting as `anon` / `authenticated` returns zero rows / permission denied on every `public` table.
- **Rate limit / spam**: honeypot rejects; N+1th submission in window rejected; oversized/disallowed upload rejected.
- **Accessibility smoke**: Playwright + axe on home, product list, contact, login, dashboard.
- **Responsive**: screenshots at 390×844 and 1440×900 reviewed manually per module before sign-off.

## CI (GitHub Actions, added Step 1)

`pnpm install --frozen-lockfile` → `lint` → `typecheck` → start Postgres service → `db:migrate` on clean DB →
`test` → `build`. E2E on pull requests against a Postgres service.
