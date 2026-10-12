import { afterEach, describe, expect, it, vi } from "vitest";
import { demoActorEnabled, isLocalDatabaseUrl } from "@/lib/auth/demo";

const enable = () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("DATABASE_URL", "postgres://postgres@127.0.0.1:5432/dev");
};
afterEach(() => vi.unstubAllEnvs());

describe("demo identity safeguards", () => {
  it("is on only in development, with DEMO_MODE, off Vercel, against a local database", () => {
    enable();
    expect(demoActorEnabled()).toBe(true);
  });
  it.each([
    ["production build", () => vi.stubEnv("NODE_ENV", "production")],
    ["test environment", () => vi.stubEnv("NODE_ENV", "test")],
    ["demo mode off", () => vi.stubEnv("DEMO_MODE", "false")],
    ["demo mode unset", () => vi.stubEnv("DEMO_MODE", "")],
    ["running on Vercel", () => vi.stubEnv("VERCEL", "1")],
    ["remote database (Supabase)", () => vi.stubEnv("DATABASE_URL", "postgresql://postgres.abc:pw@aws-0-eu.pooler.supabase.com:6543/postgres")],
    ["no database url", () => vi.stubEnv("DATABASE_URL", "")],
    ["lookalike hostname", () => vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost.evil.example:5432/db")],
  ])("is OFF for: %s", (_label, breakIt) => {
    enable();
    breakIt();
    expect(demoActorEnabled()).toBe(false);
  });
  it("recognises only loopback hosts as local", () => {
    expect(isLocalDatabaseUrl("postgres://u@localhost/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u@[::1]:5432/db")).toBe(true);
    expect(isLocalDatabaseUrl("postgres://u@10.0.0.5/db")).toBe(false);
    expect(isLocalDatabaseUrl("not a url")).toBe(false);
  });
});
