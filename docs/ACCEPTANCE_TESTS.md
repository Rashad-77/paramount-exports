# Acceptance Tests

Status key: ☐ not started · ◐ partial · ☑ passing (automated). Updated at the end of each step; nothing is ticked without a passing test.

| # | Flow | Test level | Step | Status |
|---|------|-----------|------|--------|
| 1 | Visitor submits custom enquiry with valid details + image → appears in CRM, assignee can view | integration + e2e | 2 | ☐ |
| 2 | Staff create customer, lead, follow-up task and quotation | integration | 3 | ☐ |
| 3 | Accepted quotation → order, preserving customer and line items (no duplication) | integration | 3/4 | ☐ |
| 4 | Ready-made order reserves/deducts stock once; concurrent orders can't oversell | integration (real Postgres, parallel tx) | 4 | ☐ |
| 5 | Custom order creates production job with specs + reference images | integration | 5 | ☐ |
| 6 | Workshop updates assigned job stage; unauthorized roles blocked from finance data | integration + authz matrix | 1 (matrix), 5 | ◐ permission-matrix unit tests pass; job-stage flow is Step 5 |
| 7 | Timber receipt increases stock only by quantity actually received (partial receipts) | integration | 5 | ☐ |
| 8 | Material consumption decreases stock once, linked to correct job | integration | 5 | ☐ |
| 9 | Job completion records status; optional finished-goods movement without duplicates | integration | 5 | ☐ |
| 10 | Payments update outstanding balance with decimal arithmetic | unit + integration | 4 | ☐ |
| 11 | Showroom ↔ workshop transfer records both sides atomically | integration | 4 | ☐ |
| 12 | Public visitors cannot access internal customers/orders/suppliers/files (app + DB roles) | integration + e2e | 1 (DB roles), 2 | ◐ DB-role denial + `/app` redirect tested; data/file routes arrive with their modules |
| 13 | Key forms show understandable validation/error messages | e2e + unit (schemas) | 2–6 | ☐ |
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
