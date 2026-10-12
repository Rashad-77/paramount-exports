/* eslint-disable no-console */
/**
 * Loads pages in a real browser and reports console errors/warnings and uncaught exceptions.
 *   pnpm tsx scripts/console-check.ts http://localhost:3000 / /products ...   (DEMO_ROLE=owner for staff pages in dev)
 * Exits non-zero if anything is reported.
 */
import { chromium } from "@playwright/test";

async function main() {
  const [baseUrl = "http://localhost:3000", ...paths] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await (await browser.newContext()).newPage();
  const problems: string[] = [];
  let current = "";
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`[${current}] console.${m.type()}: ${m.text().slice(0, 400)}`);
  });
  page.on("pageerror", (e) => problems.push(`[${current}] exception: ${e.message.slice(0, 400)}`));
  if (process.env.DEMO_ROLE) await page.goto(new URL(`/dev/demo-role?role=${process.env.DEMO_ROLE}`, baseUrl).toString());
  for (const p of paths.length ? paths : ["/"]) {
    current = p;
    await page.goto(new URL(p, baseUrl).toString(), { waitUntil: "networkidle" });
  }
  await browser.close();
  if (problems.length) {
    console.log(problems.join("\n"));
    process.exit(1);
  }
  console.log("No console errors or warnings.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
