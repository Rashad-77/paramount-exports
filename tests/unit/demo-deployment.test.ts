import { describe, expect, it } from "vitest";
import { demoDeploymentEnabled } from "@/lib/auth/demo-deployment";

const DB = "postgres://u:p@db.example.com/app";

describe("public demo deployment switch", () => {
  it("is off unless explicitly enabled", () => {
    expect(demoDeploymentEnabled({ DATABASE_URL: DB })).toBe(false);
    expect(demoDeploymentEnabled({ DEMO_DEPLOYMENT: "false", DATABASE_URL: DB })).toBe(false);
    expect(demoDeploymentEnabled({ DEMO_DEPLOYMENT: "1", DATABASE_URL: DB })).toBe(false);
    expect(demoDeploymentEnabled({})).toBe(false);
  });

  it("needs a database", () => {
    expect(demoDeploymentEnabled({ DEMO_DEPLOYMENT: "true" })).toBe(false);
    expect(demoDeploymentEnabled({ DEMO_DEPLOYMENT: "true", DATABASE_URL: DB })).toBe(true);
  });

  it("switches itself off as soon as ANY Supabase sign-in setting exists, so it cannot bypass real authentication", () => {
    for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      expect(demoDeploymentEnabled({ DEMO_DEPLOYMENT: "true", DATABASE_URL: DB, [name]: "x" }), name).toBe(false);
    }
  });
});
