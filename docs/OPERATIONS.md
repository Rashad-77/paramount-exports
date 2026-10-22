# Operations guide

For whoever runs the system day to day (the owner, or the person they ask). Nothing here has been run against a real
Supabase project or a real Vercel deployment yet; see `docs/KNOWN_LIMITATIONS.md`. Treat the first deployment as a rehearsal
and keep this list beside you.

## 1. One-time setup

1. **Supabase project** (separate projects for production and previews).
   - Note the project URL, the anon/publishable key, the service-role key, the **transaction pooler** connection string
     (port 6543) and the **direct** connection string (port 5432).
2. **Vercel project** from this repository (Next.js preset). Add every variable in `.env.example`, Production and Preview
   separately. `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `IP_HASH_SALT` and the database strings are secrets: never prefix them with `NEXT_PUBLIC_`.
3. From a trusted computer with the production variables in `.env.local`:
   ```bash
   pnpm db:migrate        # creates every table, constraint, trigger and security rule
   pnpm storage:setup     # creates the two storage buckets (private files, public photos)
   OWNER_PASSWORD='a long passphrase' pnpm create-owner --email you@example.com --name "Your Name"
   ```
   **If the database already holds data from the old CRM/ERP version, back it up first:** migration `0015` deletes those tables.
4. Deploy. Check `/api/health` shows `{"status":"ok","database":"up"}`; sign in at `/login`.
5. In the app, open **Settings** and fill in: business name (until the real name is saved the public site stays "noindex" with a
   placeholder notice), telephone and WhatsApp, showroom address, map link and opening hours, **bank details** (shown to customers who
   choose to pay by transfer), and confirm the **currency and time zone**. The dashboard checklist shows what is still missing.
6. Add categories and products. **A customer can only order an option that has a price, on a product that is published and has
   "Show price publicly" switched on.** Others show an enquiry form instead.
7. The wording of the About, Privacy and Terms pages and the showroom and workshop photographs are not edited in the dashboard; they are part of the website itself.

## 2. Handling orders (daily)

1. The **dashboard** shows new orders and messages. Orders are in **Orders**; the *New* tab is what is waiting.
2. Open a new order. **Phone or message the customer** (their number and email are on the order) to confirm it and agree delivery
   and the delivery charge. Enter the **delivery charge** and save: the total updates.
3. Press **Confirm order**, later **Start preparing**, and **Mark as delivered**. Cancel with a reason if the customer withdraws or
   cannot be reached. Cancelled and delivered orders are final.
4. When the money arrives (cash on delivery, a transfer in your bank, or at the showroom) press **Mark as paid**. You can undo it.
   The website never marks anything paid.
5. **Messages** holds contact-form messages, product enquiries and custom-furniture requests (with their pictures). Reply by phone or
   email, then press **Mark as handled**.
6. **Customers** lists everyone who has ordered, grouped by phone number, with their order history.

There are no automatic emails or texts: customers are told on the confirmation page that you will contact them, so check the
dashboard regularly.

## 3. People

- The Owner adds people from a trusted computer: `OWNER_PASSWORD='one-off password' pnpm create-user --email sam@example.com --name "Sam" --role staff`
  (`--role owner` for another owner). Hand over the one-off password privately and ask them to change it.
  *There is no self-service sign-up and no invite email in this version.*
- **Users** (Owner only) changes roles and deactivates/reactivates people. A deactivated person is locked out on their next request.
  The system refuses to leave the business without an active owner.
- **Owner** can do everything; **Staff** can run orders, messages, customers, products, gallery and website pages but cannot manage users or
  business settings. Exactly what each can do: `docs/ROLE_PERMISSIONS.md` (generated from the code and checked by a test).
- People who held the retired roles (manager, sales, workshop, finance) have no access after migration `0015` until given Owner or Staff.

## 4. Releasing a change

1. Pull request, then CI must pass (lint, typecheck, unit + database tests, build, browser tests).
2. Merge, then Vercel deploys. **Migrations do not run on deploy.** If the change adds files under `drizzle/`, run `pnpm db:migrate`
   against production *before or immediately after* the deploy. Migrations are forward-only.
3. Never edit a migration that has been applied anywhere. Fix mistakes with a new migration.
4. Preview deployments use their own Supabase project. Never copy production data into a preview.

## 5. Backups and restore

Orders, customers and messages live only in the Postgres database; uploaded files live in Supabase Storage.

- **Database**: turn on Supabase's automatic backups (daily on paid plans) and, for point-in-time recovery, the PITR add-on.
  Decide how much loss is acceptable (for example "at most a day") and buy that level.
- **Your own copy** (recommended weekly, kept somewhere that is not the same account):
  ```bash
  pg_dump --format=custom --no-owner --file=backup-$(date +%F).dump "$DATABASE_DIRECT_URL"
  ```
- **Files**: download the `private-files` and `public-media` buckets periodically. Database rows reference files by key, so keep both together.
- **Test a restore before you need it**: create an empty scratch Postgres (never the production one), `pg_restore --no-owner --dbname "$SCRATCH_URL" backup-YYYY-MM-DD.dump`,
  point a local copy of the app at it, and check you can open recent orders. Delete the scratch database.

## 6. Scheduled work

`vercel.json` runs `/api/cron/housekeeping` daily (21:00 UTC). It deletes old rate-limit counters and removes uploads that were never
attached to anything. It also refreshes the resized copies of published product photographs: each day it asks for the next 40 photographs
(wrapping round) at the sizes customers use, so a copy the network has thrown away is made overnight and not by a customer. It stops by
itself after about 40 seconds. It needs `CRON_SECRET`; without it the endpoint refuses every request. If a step fails the others still run
and the failure is logged in the Vercel function logs. The response lists what each step did, including `photoSizesRefreshed`.

## 7. When something looks wrong

| Symptom | Check |
|---|---|
| Nobody can sign in | Supabase status; `NEXT_PUBLIC_SUPABASE_*` variables; the person's profile is *active* and has a role (Users page). Repeated wrong passwords lock a login for about 10 minutes |
| "Sign-in is temporarily unavailable" | The database is unreachable (the login limiter fails closed). Check `/api/health` |
| Orders or messages stopped arriving | `/api/health`; Vercel logs for the order or enquiry action; the spam limits (per address and per phone, `src/server/orders.ts` and `messages.ts`); Turnstile keys if enabled |
| A customer says they could not order | The product needs a price and "Show price publicly"; the checkout also needs a delivery address for delivery; the customer may have hit the rate limit (wait, or take the order by phone) |
| Uploads fail | Storage buckets exist (`pnpm storage:setup`); `SUPABASE_SERVICE_ROLE_KEY` set on the server; file is JPEG/PNG/WebP and within the size limit |
| The dev server flickers or recompiles in a loop | The project is inside OneDrive. Move it outside (for example `C:\dev\paramount`) |

Errors shown to users carry a short reference; the same reference is in the Vercel function log with the technical detail.

## 8. Security housekeeping

- Rotate `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and `IP_HASH_SALT` if they may have leaked (changing the salt only resets rate-limit counters).
- Review **Users** whenever someone leaves.
- The audit log (`audit_logs`) records every order change and who made it; it cannot be edited or deleted, even by the application.
- See `docs/SECURITY_REVIEW.md` for what was checked and what remains.
