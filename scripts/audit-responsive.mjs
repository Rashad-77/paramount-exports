/* Responsive check: opens every public page at ten widths (320 to 1920px) in Chrome and reports sideways scrolling or clipped content.
 * Run with the site on http://localhost:3000:  node scripts/audit-responsive.mjs */
import { chromium } from "@playwright/test";

const base = "http://localhost:3000";
const pages = ["/", "/products", "/gallery", "/about", "/contact", "/custom", "/help", "/cart", "/checkout", "/track", "/privacy", "/terms", "/account/sign-in", "/login"];
const widths = [320, 375, 414, 600, 768, 900, 1024, 1280, 1440, 1920];

const probe = () => {
  const W = innerWidth;
  const inClip = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
    return false;
  };
  const over = [];
  const cut = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.classList.contains("sr-only")) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.visibility === "hidden" || cs.display === "none") continue;
    const nm = (el.tagName + "." + String(el.className).split(" ").slice(0, 2).join(".")).slice(0, 44);
    if (r.right > W + 1 && !inClip(el)) over.push(nm + " r=" + Math.round(r.right));
    if (/(hidden|clip)/.test(cs.overflow) && !/IMG|VIDEO|IFRAME|svg/i.test(el.tagName) && el.clientHeight > 0 && !el.querySelector("img,video,iframe,svg") && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3))
      cut.push(nm + " content " + el.scrollWidth + "x" + el.scrollHeight + " in " + el.clientWidth + "x" + el.clientHeight);
  }
  return { sw: document.documentElement.scrollWidth, W, over, cut };
};

const browser = await chromium.launch({ channel: "chrome" });
const issues = {};
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const p of pages) {
    try {
      await page.goto(base + p, { waitUntil: "networkidle", timeout: 60000 });
    } catch {
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(400);
    const r = await page.evaluate(probe);
    const problems = [];
    if (r.sw > r.W + 1) problems.push("page scrolls sideways (" + r.sw + " > " + r.W + ")");
    for (const o of r.over.slice(0, 3)) problems.push("overflows: " + o);
    for (const c of r.cut.slice(0, 3)) problems.push("clipped: " + c);
    if (problems.length) (issues[p] ??= []).push(w + "px: " + problems.join(" ; "));
  }
  await ctx.close();
}
await browser.close();
for (const [p, list] of Object.entries(issues)) {
  console.log("\n" + p);
  for (const l of list) console.log("  " + l);
}
if (!Object.keys(issues).length) console.log("No problems found at any width.");
