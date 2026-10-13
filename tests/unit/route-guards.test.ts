import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guards: the places where an access check could be forgotten are listed here so a new file cannot slip in without one.
 * (The behavioural checks live in the integration tests; these catch "someone added a route and forgot".)
 */
const ROOT = path.join(process.cwd(), "src/app");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
const read = (p: string) => readFileSync(p, "utf8");
const rel = (p: string) => path.relative(process.cwd(), p);

describe("access-control structure", () => {
  it("the staff area's layout requires a signed-in, active person", () => {
    expect(read(path.join(ROOT, "app/layout.tsx"))).toContain("requireActor()");
  });

  it("every staff Server Action goes through runAction (which needs a signed-in actor)", () => {
    const actionFiles = files(path.join(ROOT, "app")).filter((f) => f.endsWith("actions.ts"));
    expect(actionFiles.length).toBeGreaterThan(4);
    for (const f of actionFiles) {
      const src = read(f);
      const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]!);
      expect(exported.length, rel(f)).toBeGreaterThan(0);
      for (const name of exported) {
        const body = src.slice(src.indexOf(`export async function ${name}`)).split(/\nexport async function /)[0]!;
        expect(body, `${rel(f)} › ${name}`).toMatch(/runAction\(/);
        expect(body, `${rel(f)} › ${name} must not be a public action`).not.toMatch(/public:\s*true/);
      }
    }
  });

  it("every API route either checks the actor/secret itself or is on the reviewed public list", () => {
    const publicRoutes = new Set(["api/health/route.ts", "api/form-token/route.ts", "api/files/public/[...key]/route.ts", "api/uploads/sign/route.ts", "api/uploads/local/route.ts"]);
    for (const f of files(path.join(ROOT, "api")).filter((p) => p.endsWith("route.ts"))) {
      const key = path.relative(ROOT, f).split(path.sep).join("/");
      if (publicRoutes.has(key)) continue;
      expect(read(f), key).toMatch(/getActor\(|CRON_SECRET|authorised\(/);
    }
  });

  it("the reviewed public routes are the only ones outside the staff area that accept anonymous input", () => {
    // uploads/sign accepts anonymous requests but only for the public enquiry purpose (checked in the service); local uploads are refused outside development/e2e.
    const sign = read(path.join(ROOT, "api/uploads/sign/route.ts"));
    expect(sign).toContain("requestUpload");
    const local = read(path.join(ROOT, "api/uploads/local/route.ts"));
    expect(local).toMatch(/localStorageAllowed|STORAGE_DRIVER/);
  });
});
