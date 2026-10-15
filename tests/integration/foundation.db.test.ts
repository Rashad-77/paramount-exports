import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, hasTestDb, type TestDb } from "../helpers/db";

describe.skipIf(!hasTestDb)("foundation schema (real Postgres)", () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
  });
  afterAll(async () => {
    await t?.close();
  });

  it("applies all migrations to a clean database, leaving the order tables and none of the retired CRM or ERP tables", async () => {
    const names = (await t.sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_\_drizzle%'`).map((r) => r.tablename as string);
    for (const kept of ["online_orders", "online_order_items", "messages", "products", "product_variants", "gallery_projects", "profiles", "user_roles", "audit_logs", "uploaded_files", "site_settings"]) {
      expect(names, kept).toContain(kept);
    }
    for (const gone of ["leads", "customers", "quotations", "sales_orders", "payments", "inventory_items", "production_jobs", "suppliers", "purchase_orders", "deliveries", "expenses", "after_sales_cases", "locations"]) {
      expect(names, gone).not.toContain(gone);
    }
  });

  it("numbers orders and messages with readable references", async () => {
    const [r] = await t.sql`SELECT next_reference('order') AS o, next_reference('message') AS m`;
    expect(r).toMatchObject({ o: "ORD-000001", m: "MSG-000001" });
    await expect(t.sql`SELECT next_reference('quotation')`).rejects.toThrow();
  });

  it("has row level security enabled on every public table", async () => {
    const rows = await t.sql`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
        AND c.relname NOT LIKE '\\_\\_drizzle%'`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("denies the anon and authenticated API roles on every public table", async () => {
    const tables = await t.sql`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    expect(tables.length).toBeGreaterThan(5);
    for (const role of ["anon", "authenticated"]) {
      for (const { relname } of tables) {
        const [r] = await t.sql.unsafe(
          `SELECT has_table_privilege('${role}', 'public."${relname}"', 'SELECT') AS s,
                  has_table_privilege('${role}', 'public."${relname}"', 'INSERT') AS i`,
        );
        expect({ role, table: relname, select: r!.s, insert: r!.i }).toEqual({
          role,
          table: relname,
          select: false,
          insert: false,
        });
      }
    }
  });

  it("lets the anon and authenticated API roles execute no function in public (no RPC exposure)", async () => {
    const fns = await t.sql`
      SELECT p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'`;
    expect(fns.length).toBeGreaterThan(0);
    for (const role of ["anon", "authenticated"]) {
      for (const { sig } of fns) {
        const [r] = await t.sql.unsafe(`SELECT has_function_privilege('${role}', '${sig}', 'EXECUTE') AS x`);
        expect({ role, fn: sig, canExecute: r!.x }).toEqual({ role, fn: sig, canExecute: false });
      }
    }
  });

  it("makes audit_logs append-only (update, delete, truncate all rejected)", async () => {
    await t.sql`INSERT INTO audit_logs (action, entity_type) VALUES ('test.insert', 'test')`;
    await expect(t.sql`UPDATE audit_logs SET action = 'tampered'`).rejects.toThrow(/append-only/);
    await expect(t.sql`DELETE FROM audit_logs`).rejects.toThrow(/append-only/);
    await expect(t.sql`TRUNCATE audit_logs`).rejects.toThrow(/append-only/);
    const [{ n }] = (await t.sql`SELECT count(*)::int AS n FROM audit_logs`) as unknown as [{ n: number }];
    expect(n).toBe(1);
  });

  it("generates unique, well-formed references under concurrency", async () => {
    const refs = await Promise.all(
      Array.from({ length: 60 }, async () => {
        const [r] = await t.sql`SELECT next_reference('order') AS ref`;
        return r!.ref as string;
      }),
    );
    expect(new Set(refs).size).toBe(60);
    for (const ref of refs) expect(ref).toMatch(/^ORD-\d{6}$/);
    const [m] = await t.sql`SELECT next_reference('message') AS ref`;
    expect(m!.ref).toMatch(/^MSG-\d{6}$/);
  });

  it("rejects unknown reference kinds instead of returning NULL", async () => {
    await expect(t.sql`SELECT next_reference('nonsense')`).rejects.toThrow(/Unknown reference kind/);
  });

  it("ties profiles to auth identities and keeps one row per (user, role)", async () => {
    await expect(
      t.sql`INSERT INTO profiles (id, full_name) VALUES (gen_random_uuid(), 'No Auth User')`,
    ).rejects.toThrow(/foreign key/i);

    const [u] = await t.sql`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'a@example.test') RETURNING id`;
    await t.sql`INSERT INTO profiles (id, full_name) VALUES (${u!.id}, 'Test Owner')`;
    await t.sql`INSERT INTO user_roles (user_id, role) VALUES (${u!.id}, 'owner')`;
    await expect(t.sql`INSERT INTO user_roles (user_id, role) VALUES (${u!.id}, 'owner')`).rejects.toThrow(/duplicate key/i);
    await t.sql`INSERT INTO user_roles (user_id, role) VALUES (${u!.id}, 'manager')`;
  });

  it("bumps updated_at on update", async () => {
    const [u] = await t.sql`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'tick@example.test') RETURNING id`;
    const [before] = await t.sql`INSERT INTO profiles (id, full_name) VALUES (${u!.id}, 'Before') RETURNING updated_at`;
    await new Promise((r) => setTimeout(r, 20));
    const [after] = await t.sql`UPDATE profiles SET full_name = 'After' WHERE id = ${u!.id} RETURNING updated_at`;
    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(new Date(before!.updated_at).getTime());
  });
});
