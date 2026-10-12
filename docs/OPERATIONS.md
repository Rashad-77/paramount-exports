# Operations guide

For whoever runs the system day to day (the owner, or the person they ask). Nothing here has been run against a real
Supabase project or a real Vercel deployment yet — see `docs/KNOWN_LIMITATIONS.md`. Treat the first deployment as a rehearsal
and keep this list beside you.

## 1. One-time setup

1. **Supabase project** (separate projects for production and previews).
   - Note the project URL, the anon/publishable key, the service-role key, the **transaction pooler** connection string
     (port 6543) and the **direct** connection string (port 5432).
2. **Vercel project** from this repository (Next.js preset). Add every variable in `.env.example` — Production and Preview
   separately. `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `IP_HASH_SALT` and the database strings are secrets: never prefix them with `NEXT_PUBLIC_`.
3. From a trusted computer with the production variables in `.env.local`:
   ```bash
   pnpm db:migrate        # creates every table, constraint, trigger and security rule
   pnpm storage:setup     # creates the two storage buckets (private files, public photos)
   OWNER_PASSWORD='a long passphrase' pnpm create-owner --email you@example.com --name "Your Name"
   ```
4. Deploy. Check `/api/health` shows `{"status":"ok","database":"up"}`; sign in at `/login`.
5. In the app: **Settings** (business name, phone, address, hours — until the real name is saved the public site stays
   "noindex" with placeholder text), confirm **currency and time zone**, set the **discount limit** for sales staff, then add
   products, photos and opening stock. Page wording (About, Privacy, Terms) is under **Website**.

## 2. People

- The Owner adds people from a trusted computer: `OWNER_PASSWORD='one-off password' pnpm create-user --email sam@example.com --name "Sam" --role sales,finance`
  (comma-separated roles; a person gets everything any of their roles allows). Hand over the one-off password privately and ask them to change it.
  *There is no self-service sign-up and no invite email in this version.*
- **Employees** (Owner only) changes roles and deactivates/reactivates people. A deactivated person is locked out on their next request.
  The system refuses to leave the business without an active owner.
- Roles and exactly what each can do: `docs/ROLE_PERMISSIONS.md` (generated from the code and checked by a test).

## 3. Releasing a change

1. Pull request → CI must pass (lint, typecheck, unit + database tests, build, browser smoke tests).
2. Merge → Vercel deploys. **Migrations do not run on deploy.** If the change adds files under `drizzle/`, run `pnpm db:migrate`
   against production *before or immediately after* the deploy (the app is written so new columns are added before code relies on them; migrations are forward-only and additive).
3. Never edit a migration that has been applied anywhere. Fix mistakes with a new migration.
4. Preview deployments use their own Supabase project. Never copy production data into a preview.

## 4. Backups and restore

Money, stock and customer records live only in the Postgres database; uploaded files live in Supabase Storage.

- **Database**: turn on Supabase's automatic backups (daily on paid plans) and, for point-in-time recovery, the PITR add-on.
  The business does not stop being valuable after a bad day: decide how much loss is acceptable (e.g. "at most a day") and buy that level.
- **Your own copy** (recommended weekly, kept somewhere that is not the same account):
  ```bash
  pg_dump --format=custom --no-owner --file=backup-$(date +%F).dump "$DATABASE_DIRECT_URL"
  ```
- **Files**: download the `private-files` and `public-media` buckets periodically (Supabase dashboard or `supabase storage cp -r`). Database rows reference files by key, so keep both together.
- **Test a restore before you need it** (once, now, and after major changes):
  1. Create an empty scratch Postgres (never the production one).
  2. `pg_restore --no-owner --dbname "$SCRATCH_URL" backup-YYYY-MM-DD.dump`
  3. Point a local copy of the app at it (`DATABASE_URL=$SCRATCH_URL pnpm dev`) and check you can open recent orders, payments and stock.
  4. Run the ledger check below. Delete the scratch database.
- **Reconciliation check** (stock balances must equal the sum of their movements). In the SQL editor, or as the integration tests do:
  ```sql
  SELECT b.item_id, b.location_id, b.on_hand, coalesce(sum(m.on_hand_delta), 0) AS ledger
  FROM inventory_balances b LEFT JOIN inventory_movements m USING (item_id, location_id)
  GROUP BY b.item_id, b.location_id, b.on_hand HAVING b.on_hand <> coalesce(sum(m.on_hand_delta), 0);
  ```
  An empty result is healthy. Anything else: stop, take a backup, and investigate before adjusting stock.

## 5. Scheduled work

`vercel.json` runs `/api/cron/housekeeping` daily (21:00 UTC). It expires old quotations, deletes old rate-limit counters and removes
uploads that were never attached to anything. It needs `CRON_SECRET`; without it the endpoint refuses every request. If a step fails the
others still run and the failure is logged in the Vercel function logs.

## 6. When something looks wrong

| Symptom | Check |
|---|---|
| Nobody can sign in | Supabase status; `NEXT_PUBLIC_SUPABASE_*` variables; the person's profile is *active* and has a role (Employees page). Repeated wrong passwords lock a login for ~10 minutes ("Too many sign-in attempts") |
| "Sign-in is temporarily unavailable" | The database is unreachable (the login limiter fails closed). Check `/api/health` |
| Enquiries stopped arriving | `/api/health`; Vercel logs for the enquiry action; the spam limits (per IP and per phone, see `src/server/enquiries.ts`); Turnstile keys if enabled |
| Uploads fail | Storage buckets exist (`pnpm storage:setup`); `SUPABASE_SERVICE_ROLE_KEY` set on the server; file is JPEG/PNG/WebP (PDF where documents are allowed) and within the size limit |
| Stock looks wrong | Open the item's ledger (Stock → item). Every change is a movement with who/why. Run the reconciliation query above. Correct mistakes with an adjustment that has a reason — never by editing rows |
| A payment/expense was entered wrongly | Void it with a reason (payments: on the order; expenses: on the Expenses page) and enter it again. Voids are kept and audited |
| An order cannot be confirmed | The message lists exactly which items are short. Receive stock or reduce the quantity |

Errors shown to users carry a short reference; the same reference is in the Vercel function log with the technical detail.

## 7. Security housekeeping

- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `IP_HASH_SALT` if they may have leaked (changing the salt only resets rate-limit counters).
- Review **Employees** whenever someone leaves.
- The audit log (`audit_logs`) records sensitive changes and who made them; it cannot be edited or deleted, even by the application.
- See `docs/SECURITY_REVIEW.md` for what was checked and what remains.
