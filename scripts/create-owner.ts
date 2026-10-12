/* eslint-disable no-console */
/**
 * Bootstrap the first Owner account (there is no public sign-up).
 *
 *   OWNER_PASSWORD='a long passphrase' pnpm create-owner --email owner@example.com --name "Full Name"
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_DIRECT_URL (or DATABASE_URL).
 * Run it from a trusted machine only; the service-role key must never be present in browser code or CI logs.
 * The password is read from the environment (not argv) so it does not appear in shell history or `ps`.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { parseArgs } from "node:util";

config({ path: ".env.local" });
config();

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  const email = values.email?.trim().toLowerCase();
  const name = values.name?.trim();
  const password = process.env.OWNER_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;

  const problems: string[] = [];
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("--email is required and must be a valid address");
  if (!name) problems.push('--name is required (e.g. --name "Full Name")');
  if (!password || password.length < 12) problems.push("OWNER_PASSWORD must be set to at least 12 characters");
  if (!url) problems.push("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) problems.push("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!dbUrl) problems.push("DATABASE_DIRECT_URL (or DATABASE_URL) is not set");
  if (problems.length) {
    console.error(problems.map((p) => `- ${p}`).join("\n"));
    process.exit(1);
  }

  const admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const sql = postgres(dbUrl!, { max: 1, onnotice: () => {} });

  const { data, error } = await admin.auth.admin.createUser({ email: email!, password: password!, email_confirm: true });
  if (error || !data.user) {
    console.error("Could not create the auth user:", error?.message ?? "unknown error");
    await sql.end();
    process.exit(1);
  }
  const userId = data.user.id;

  try {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO profiles (id, full_name) VALUES (${userId}, ${name!})`;
      await tx`INSERT INTO user_roles (user_id, role, granted_by) VALUES (${userId}, 'owner', ${userId})`;
      await tx`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, after)
               VALUES (${userId}, 'user.owner_bootstrapped', 'profile', ${userId}, ${tx.json({ email: email!, role: "owner" })})`;
    });
    console.log(`Owner created: ${email} (${userId}). You can now sign in at /login.`);
  } catch (err) {
    // Do not leave an orphaned auth user that has no profile.
    await admin.auth.admin.deleteUser(userId);
    console.error("Database step failed; the auth user was removed.", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
