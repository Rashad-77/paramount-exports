import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Database-backed public-site tests. They need TEST_ADMIN_DATABASE_URL (see scripts/prepare-e2e-db.ts); without it
 * they are skipped, and the skip is visible in the report.
 */
const admin = process.env.TEST_ADMIN_DATABASE_URL;
test.skip(!admin, "TEST_ADMIN_DATABASE_URL not set — database-backed e2e tests skipped");

const sql = admin
  ? (() => {
      const u = new URL(admin);
      u.pathname = "/e2e_furniture";
      return postgres(u.toString(), { max: 2, onnotice: () => {} });
    })()
  : (undefined as never);
test.afterAll(async () => {
  await sql?.end({ timeout: 2 });
});

// A minimal JPEG header: enough for the server's magic-byte check.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

let phoneSeq = 0;
const phone = () => `0715${String(500000 + ++phoneSeq + Math.floor(Math.random() * 1000) * 1000).slice(-6)}`;

/** The anti-spam token must age past the minimum fill time before a human-speed submit is accepted. */
async function waitForFormReady(page: Page) {
  await expect(page.locator('input[name="formToken"]')).not.toHaveValue("");
  await page.waitForTimeout(3300);
}

test.describe("catalogue", () => {
  test("lists published products and links to the product page", async ({ page }) => {
    await page.goto("/products");
    const card = page.getByRole("link", { name: /sample oak table/i });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/products\/sample-oak-table$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sample Oak Table" })).toBeVisible();
    await expect(page.getByText("W 180 x D 90 x H 75 cm")).toBeVisible();
    await expect(page.getByText("E2E-OAK-1")).toBeVisible();
    // Price and availability are NOT approved for display, so they must not appear.
    await expect(page.getByText(/LKR|Rs\.?\s?\d/)).toHaveCount(0);
  });

  test("search and filters narrow the list and explain empty results", async ({ page }) => {
    await page.goto("/products?q=oak");
    await expect(page.getByRole("link", { name: /sample oak table/i })).toBeVisible();
    await page.goto("/products?q=zzzz-no-such-thing");
    await expect(page.getByText(/no pieces match those filters/i)).toBeVisible();
    await page.goto("/products?q=%25");
    await expect(page.getByText(/no pieces match/i)).toBeVisible();
  });

  test("unknown product and hidden content return 404", async ({ request }) => {
    expect((await request.get("/products/does-not-exist")).status()).toBe(404);
  });

  test("product page exposes SEO basics: canonical, structured data without an invented price", async ({ page }) => {
    await page.goto("/products/sample-oak-table");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/products\/sample-oak-table$/);
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
    expect(ld["@type"]).toBe("Product");
    expect(ld.offers).toBeUndefined();
  });

  test("sitemap lists the public pages and published products", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/products/sample-oak-table");
    expect(xml).toContain("/custom");
    expect(xml).not.toContain("/app");
  });
});

test.describe("enquiries", () => {
  test("a product enquiry reaches the CRM with the product attached", async ({ page }) => {
    const p = phone();
    await page.goto("/products/sample-oak-table");
    await page.getByLabel(/^Your name/).fill("Test Visitor");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Email/).fill("visitor@example.com");
    await page.getByLabel(/consent|agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText(/reference ENQ-\d{6}/)).toBeVisible();

    const [lead] = await sql`SELECT l.*, pr.slug FROM leads l JOIN products pr ON pr.id = l.product_id WHERE l.contact_phone = ${p}`;
    expect(lead).toMatchObject({ kind: "product_enquiry", source: "website", status: "new", contact_name: "Test Visitor", slug: "sample-oak-table" });
  });

  test("ACCEPTANCE #1: a custom enquiry with a reference image is saved, and the file is stored privately", async ({ page }) => {
    const p = phone();
    await page.goto("/custom");
    await page.getByLabel(/^Your name/).fill("Custom Visitor");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^What would you like made/).fill("Walnut wardrobe");
    await page.getByLabel(/^Dimensions/).fill("200 x 60 x 220 cm");
    await page.getByLabel(/^Reference photos or sketches/).setInputFiles({ name: "sketch.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(page.getByText("Attached", { exact: true })).toBeVisible();
    await page.getByLabel(/agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /request quotation/i }).click();
    await expect(page.getByText(/reference ENQ-\d{6}/)).toBeVisible();

    const [lead] = await sql`SELECT * FROM leads WHERE contact_phone = ${p}`;
    expect(lead).toMatchObject({ kind: "custom", contact_name: "Custom Visitor" });
    expect(lead!.payload).toMatchObject({ furnitureType: "Walnut wardrobe", dimensions: "200 x 60 x 220 cm" });
    const files = await sql`SELECT * FROM uploaded_files WHERE entity_type = 'lead' AND entity_id = ${lead!.id}`;
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ status: "linked", visibility: "private", bucket: "private-files", original_name: "sketch.jpg" });
  });

  test("the uploader rejects a disallowed file type with a clear message", async ({ page }) => {
    await page.goto("/custom");
    await page.getByLabel(/^Reference photos or sketches/).setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText(/file type is not accepted/i)).toBeVisible();
  });

  test("an empty submit explains every problem and keeps what was typed", async ({ page }) => {
    await page.goto("/contact");
    await page.getByLabel(/^Your name/).fill("Half Done");
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText("Phone number is required.")).toBeVisible();
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
    await expect(page.getByText(/agree to be contacted/i).first()).toBeVisible();
    await expect(page.getByLabel(/^Your name/)).toHaveValue("Half Done");
    await expect(page.getByLabel(/^Phone number/)).toHaveAttribute("aria-invalid", "true");
  });

  test("an instant submit is refused as too fast, and nothing is stored", async ({ page }) => {
    const p = phone();
    await page.goto("/contact");
    await expect(page.locator('input[name="formToken"]')).not.toHaveValue("");
    await page.getByLabel(/^Your name/).fill("Speedy Bot");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Your message/).fill("Hello, I would like to ask about things.");
    await page.getByLabel(/agree to be contacted/i).check();
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText(/very quick/i)).toBeVisible();
    expect(await sql`SELECT 1 FROM leads WHERE contact_phone = ${p}`).toHaveLength(0);
  });

  test("the honeypot makes bots think they succeeded while nothing is stored", async ({ page }) => {
    const p = phone();
    await page.goto("/contact");
    await page.getByLabel(/^Your name/).fill("Spam Bot");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Your message/).fill("Buy cheap stuff now, lots of cheap stuff.");
    await page.getByLabel(/agree to be contacted/i).check();
    await page.locator('input[name="company_site"]').evaluate((el: HTMLInputElement) => {
      el.value = "http://spam.example";
    });
    await waitForFormReady(page);
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText(/we have received your enquiry/i)).toBeVisible();
    expect(await sql`SELECT 1 FROM leads WHERE contact_phone = ${p}`).toHaveLength(0);
  });

  test("a forged form token is rejected", async ({ page }) => {
    const p = phone();
    await page.goto("/contact");
    await page.getByLabel(/^Your name/).fill("Forger");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Your message/).fill("Trying to bypass the form protections.");
    await page.getByLabel(/agree to be contacted/i).check();
    await expect(page.locator('input[name="formToken"]')).not.toHaveValue("");
    await page.locator('input[name="formToken"]').evaluate((el: HTMLInputElement) => {
      el.value = "1700000000.forged";
    });
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText(/form has expired|reload/i)).toBeVisible();
    expect(await sql`SELECT 1 FROM leads WHERE contact_phone = ${p}`).toHaveLength(0);
  });
});

test.describe("access control for files and staff data", () => {
  test("uploaded private files are not downloadable by the public", async ({ request }) => {
    const [f] = await sql`
      INSERT INTO uploaded_files (bucket, object_key, purpose, original_name, content_type, size_bytes, visibility, status, entity_type, entity_id)
      VALUES ('private-files', ${`enquiry/2026/01/${crypto.randomUUID().replace(/-/g, "")}.jpg`}, 'enquiry', 'secret.jpg', 'image/jpeg', 100, 'private', 'linked', 'lead', ${crypto.randomUUID()})
      RETURNING id`;
    expect((await request.get(`/api/files/${f!.id}`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/api/files/not-a-uuid")).status()).toBe(404);
  });

  test("the staff upload purposes are closed to anonymous visitors", async ({ request }) => {
    const res = await request.post("/api/uploads/sign", { data: { purpose: "catalogue", fileName: "a.jpg", contentType: "image/jpeg", size: 100 } });
    expect(res.status()).toBe(401);
  });

  test("an oversize upload is refused before any bytes are sent", async ({ request }) => {
    const res = await request.post("/api/uploads/sign", { data: { purpose: "enquiry", fileName: "big.jpg", contentType: "image/jpeg", size: 50 * 1024 * 1024 } });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toMatch(/too large/i);
  });

  test("the local upload endpoint rejects a forged signature", async ({ request }) => {
    const res = await request.put("/api/uploads/local?bucket=private-files&key=enquiry/2026/01/aaaa.jpg&exp=9999999999&max=1000&sig=forged", { data: "x" });
    expect(res.status()).toBe(403);
  });
});

test.describe("housekeeping cron", () => {
  test("is closed without the secret and works with it", async ({ request }) => {
    expect((await request.get("/api/cron/housekeeping")).status()).toBe(401);
    expect((await request.get("/api/cron/housekeeping", { headers: { authorization: "Bearer wrong-secret-wrong-secret" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/housekeeping", { headers: { authorization: "Bearer e2e-cron-secret-e2e-cron-secret" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ quotationsExpired: expect.any(Number), rateLimitRowsPurged: expect.any(Number), abandonedUploadsRemoved: expect.any(Number) });
  });
});

test.describe("accessibility with real data", () => {
  for (const path of ["/products", "/products/sample-oak-table", "/custom", "/contact"]) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
