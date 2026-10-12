# Public demo on Vercel (no Supabase)

For showing the system to people. It runs entirely on **GitHub + Vercel** (plus the free Vercel-hosted Postgres database that the app
cannot work without). It is a **demonstration, not a live system**.

## What it is and is not

- Anyone with the link can open the staff area as the sample Owner (the only role offered in the demo). **There is no password.**
- Everything in it is sample data labelled `[Sample]`. Do not type real customer or business information into it.
- Photo uploads are switched off (there is no file storage); products and the gallery show without photos.
- It switches itself off safely: the demo sign-in stops working once (a) any Supabase setting is added, or (b) a real business name is saved in Settings.
  Going live means following `docs/OPERATIONS.md` instead (Supabase, real accounts).

## Setting it up (about 5 minutes, no commands)

1. **Create the database in Vercel.** Open your project → **Storage** tab → **Create Database** → choose **Neon (Postgres)** → accept the free plan → **Connect** it to this project for all environments. Vercel adds the connection settings (including `DATABASE_URL`) for you.
2. **Environment Variables** (Project → Settings → Environment Variables):
   - **Delete** every variable whose name starts with `SUPABASE` or `NEXT_PUBLIC_SUPABASE` (and `DATABASE_DIRECT_URL` if present).
   - Add `DEMO_DEPLOYMENT` = `true`
   - Add `IP_HASH_SALT` = any long random string (32+ letters/numbers)
   - Add `CRON_SECRET` = another long random string
   - Leave `DEMO_MODE` unset.
3. **Deploy the latest code.** Deployments → **Create Deployment** → branch `claude/kind-galileo-v21uuw`. During the build the system creates its own tables and loads the sample data (you will see `[demo] migrations applied` in the build log). Re-deploying later does not duplicate the data.
4. Open the link → **Staff area** → Continue as Owner.

## Resetting the demo

Everyone shares one database, so people's test entries accumulate. To start fresh: in Vercel → Storage → your Neon database → open it in Neon → delete and recreate the database (or the project's branch), then **Create Deployment** again.

## How it is guarded (for the developers)

`src/lib/auth/demo-deployment.ts` (switch), `src/lib/auth/demo.ts` (`demoSignInAllowed`), `src/proxy.ts`, `src/app/demo/*`. The switch needs `DEMO_DEPLOYMENT=true`, a database and **no** Supabase variables; sign-in additionally refuses once the business name is no longer the placeholder. `scripts/prepare-demo-db.ts` runs from `pnpm vercel-build` and does nothing unless the switch is on.
