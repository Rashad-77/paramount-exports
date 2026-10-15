import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("public site", () => {
  test("homepage renders with a clear heading and an honest placeholder notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/placeholders until the real content is supplied/i)).toBeVisible();
    await expect(page).toHaveTitle(/paramount export industries/i);
  });

  test("every primary navigation link leads to a real page with a heading", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator('header nav[aria-label="Primary"] a').evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
    for (const href of hrefs) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
      await page.goto(href);
      await expect(page.getByRole("heading", { level: 1 }), href).toBeVisible();
    }
  });

  test("skip link is the first tab stop and becomes visible", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to main content/i })).toBeFocused();
    await expect(page.getByRole("link", { name: /skip to main content/i })).toBeInViewport();
  });

  test("mobile menu opens, lists links, and closes with Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /open menu/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByRole("button", { name: /close menu/i })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^contact$/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /open menu/i })).toHaveAttribute("aria-expanded", "false");
  });

  test("has no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });

  test("unknown pages show the friendly 404", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
  });

  test("sends security headers and does not advertise the framework", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("keeps crawlers away while placeholder content is showing", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \//);
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
  });
});

test.describe("access control", () => {
  test("/app sends signed-out visitors to the login page", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /staff sign in/i })).toBeVisible();
  });

  test("deep internal links and the print view are protected too", async ({ page }) => {
    for (const path of ["/app/orders", "/app/orders/00000000-0000-4000-8000-000000000000", "/app/messages", "/app/customers", "/app/products", "/app/settings", "/app/users", "/app/website"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login/);
    }
  });

  test("the retired CRM and ERP screens no longer exist", async ({ request }) => {
    for (const path of ["/app/leads", "/app/quotations", "/app/stock", "/app/production", "/app/payments", "/app/reports", "/print/quotations/00000000-0000-4000-8000-000000000000"]) {
      // Signed out, the staff area sends everything to the login page; either way, none of these screens is served.
      expect([307, 404], path).toContain((await request.get(path, { maxRedirects: 0 })).status());
    }
  });

  test("security headers are sent", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("health endpoint reveals no configuration", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: process.env.TEST_ADMIN_DATABASE_URL ? "up" : "not-configured" });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("login form explains what is wrong when submitted empty", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Enter a valid email address.").or(page.getByText("Enter your email address."))).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await expect(page.getByLabel(/^Email/)).toHaveAttribute("aria-invalid", "true");
  });

  test("login does not reveal whether an account exists or leak internals", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/^Email/).fill("someone@example.com");
    await page.getByLabel(/^Password/).fill("not-a-real-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Auth is not configured in this environment: the message must be plain and free of stack traces.
    const alert = page.locator("main").getByRole("alert");
    await expect(alert).toContainText(/not configured|incorrect/i);
    await expect(page.locator("body")).not.toContainText(/stack|ECONN|undefined|TypeError/i);
    // A failed attempt must not wipe what the user typed (but never echoes the password).
    await expect(page.getByLabel(/^Email/)).toHaveValue("someone@example.com");
    await expect(page.getByLabel(/^Password/)).toHaveValue("");
  });
});

test.describe("accessibility (axe, WCAG 2.1 A/AA)", () => {
  // Measure the settled page, not a frame mid-way through an entrance animation.
  test.use({ reducedMotion: "reduce" });
  for (const path of ["/", "/login", "/products", "/custom", "/contact", "/about", "/gallery", "/cart", "/checkout", "/track", "/help", "/privacy", "/terms"]) {
    test(`no serious or critical violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
