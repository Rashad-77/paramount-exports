/* eslint-disable no-console */
/**
 * Visual review helper: renders pages at desktop and phone sizes and writes PNGs.
 *   DEMO_MODE=true pnpm dev      (in one terminal)
 *   pnpm tsx scripts/screenshots.ts <outDir> [baseUrl] [path ...]
 * Defaults to the pages built so far. Review the images by eye; this does not assert anything.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

async function main() {
  const [outDir, baseUrl = "http://localhost:3000", ...paths] = process.argv.slice(2);
  if (!outDir) {
    console.error("Usage: tsx scripts/screenshots.ts <outDir> [baseUrl] [path ...]");
    process.exit(1);
  }
  const targets = paths.length ? paths : ["/", "/login", "/dev/preview/app"];
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      // Optional: DEMO_ROLE=owner|manager|sales|workshop|finance signs in as the dev-only sample identity (needs DEMO_MODE=true pnpm dev).
      if (process.env.DEMO_ROLE) await page.goto(new URL(`/dev/demo-role?role=${process.env.DEMO_ROLE}`, baseUrl).toString());
      for (const target of targets) {
        const res = await page.goto(new URL(target, baseUrl).toString(), { waitUntil: "networkidle" });
        // Scroll through the page so lazy-loaded images are fetched before the full-page capture.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo({ top: y, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo({ top: 0, behavior: "instant" });
        });
        await page.waitForTimeout(400);
        const slug = target === "/" ? "home" : target.replace(/^\/|\/$/g, "").replace(/[/?=&]/g, "-");
        const file = path.join(outDir, `${slug}.${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        // Horizontal overflow is a common mobile defect: report it.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        console.log(`${res?.status()} ${vp.name.padEnd(7)} ${target} -> ${file}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ""}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
