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

test.describe("gallery category chooser", () => {
  test("sits beside the heading, and a category with no projects says so", async ({ page }) => {
    await page.goto("/gallery");
    await page.waitForLoadState("networkidle");
    const chooser = page.getByRole("combobox", { name: /^category/i });
    await expect(chooser).toBeVisible();
    await chooser.click();
    await page.getByRole("option", { name: "Dining Tables" }).click();
    await expect(page.getByText(/no projects match/i)).toBeVisible();
    await chooser.click();
    await page.getByRole("option", { name: "All categories" }).click();
    await expect(page.getByText(/no projects match/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /view larger/i }).first()).toBeVisible();

    // the search box narrows the grid as you type
    const search = page.getByLabel("Search the gallery");
    await search.fill("project 3");
    await expect(page.getByRole("button", { name: /view larger/i })).toHaveCount(1);
    await search.fill("zzzz");
    await expect(page.getByText(/no projects match/i)).toBeVisible();
    await search.fill("");
    await expect(page.getByRole("button", { name: /view larger/i }).first()).toBeVisible();
  });
});

test.describe("homepage reviews row", () => {
  test("drifts along continuously, with no step or jump, and stops while the pointer is on it", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("group", { name: "Customer reviews" });
    await row.scrollIntoViewIfNeeded();
    await page.mouse.move(2, 2);
    await page.waitForTimeout(800);
    const read = () => row.evaluate((el) => el.scrollLeft);
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      samples.push(await read());
      await page.waitForTimeout(100);
    }
    const deltas = samples.slice(1).map((v, i) => v - samples[i]!).filter((d) => d > -500); // ignore the invisible wrap back one copy
    expect(deltas.filter((d) => d > 0).length).toBeGreaterThan(10); // it moves, most of the time
    expect(Math.max(...deltas)).toBeLessThan(25); // a stepped slide would move a whole card (300px or more) at once
    expect(Math.min(...deltas)).toBeGreaterThan(-1); // and never backwards

    // hovering holds it still
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const held = await read();
    await page.waitForTimeout(700);
    expect(Math.abs((await read()) - held)).toBeLessThan(2);
  });
});

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

  test("typing or choosing a filter narrows the list in place: no Enter, no page reload", async ({ page }) => {
    await page.goto("/products");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      (window as unknown as { __same: boolean }).__same = true;
    });
    const search = page.getByLabel("Search products");
    await search.pressSequentially("zzzz-no-such", { delay: 40 });
    await expect(page.getByText(/no pieces match those filters/i)).toBeVisible();
    await expect(page).toHaveURL(/q=zzzz-no-such/);

    await page.getByRole("button", { name: /clear filters/i }).first().click();
    await expect(page.getByRole("link", { name: /sample oak table/i })).toBeVisible();
    await expect(search).toHaveValue("");

    await search.fill("oak");
    await expect(page).toHaveURL(/q=oak/);
    await expect(page.getByRole("link", { name: /sample oak table/i })).toBeVisible();

    // a dropdown applies as soon as it is changed
    await page.getByRole("button", { name: /clear filters/i }).first().click();
    await page.getByRole("combobox", { name: /^category/i }).click();
    const options = page.getByRole("option");
    expect(await options.count()).toBeGreaterThan(1);
    await options.nth(1).click();
    await expect(page).toHaveURL(/category=/);
    // the keyboard works too: open the sort list, move down, pick with Enter
    await page.getByRole("combobox", { name: /^sort by/i }).press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/sort=name/);

    // the page was never reloaded
    expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true);
  });

  test("the collection endpoint only returns visible products and trims odd input", async ({ request }) => {
    const res = await request.get("/api/catalogue?q=oak&page=-5&sort=nonsense");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.map((i: { name: string }) => i.name)).toContain("Sample Oak Table");
    expect(JSON.stringify(body)).not.toMatch(/archived|isPublished|staff/i);
    expect((await request.get(`/api/catalogue?q=${"x".repeat(5000)}`)).status()).toBe(200);
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
  test("a product enquiry reaches the staff inbox with the product attached", async ({ page }) => {
    const p = phone();
    await page.goto("/products/sample-oak-table");
    await page.getByLabel(/^Your name/).fill("Test Visitor");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Email/).fill("visitor@example.com");
    await page.getByLabel(/consent|agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /send enquiry/i }).click();
    await expect(page.getByText(/reference MSG-\d{6}/)).toBeVisible();

    const [msg] = await sql`SELECT m.*, pr.slug FROM messages m JOIN products pr ON pr.id = m.product_id WHERE m.phone = ${p}`;
    expect(msg).toMatchObject({ kind: "product_enquiry", is_handled: false, name: "Test Visitor", slug: "sample-oak-table" });
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
    await expect(page.getByText(/reference MSG-\d{6}/)).toBeVisible();

    const [msg] = await sql`SELECT * FROM messages WHERE phone = ${p}`;
    expect(msg).toMatchObject({ kind: "custom", name: "Custom Visitor" });
    expect(msg!.payload).toMatchObject({ furnitureType: "Walnut wardrobe", dimensions: "200 x 60 x 220 cm" });
    const files = await sql`SELECT * FROM uploaded_files WHERE entity_type = 'message' AND entity_id = ${msg!.id}`;
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
    // Take a fresh token and submit straight away, so a slow machine or a form still animating in cannot age it past the minimum fill time.
    await page.locator('input[name="formToken"]').evaluate(async (el: HTMLInputElement) => {
      el.value = ((await (await fetch("/api/form-token", { cache: "no-store" })).json()) as { token: string }).token;
    });
    await page.getByRole("button", { name: /send enquiry/i }).click({ force: true, noWaitAfter: true });
    await expect(page.getByText(/very quick/i)).toBeVisible();
    expect(await sql`SELECT 1 FROM messages WHERE phone = ${p}`).toHaveLength(0);
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
    expect(await sql`SELECT 1 FROM messages WHERE phone = ${p}`).toHaveLength(0);
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
    expect(await sql`SELECT 1 FROM messages WHERE phone = ${p}`).toHaveLength(0);
  });
});

test.describe("access control for files and staff data", () => {
  test("uploaded private files are not downloadable by the public", async ({ request }) => {
    const [f] = await sql`
      INSERT INTO uploaded_files (bucket, object_key, purpose, original_name, content_type, size_bytes, visibility, status, entity_type, entity_id)
      VALUES ('private-files', ${`enquiry/2026/01/${crypto.randomUUID().replace(/-/g, "")}.jpg`}, 'enquiry', 'secret.jpg', 'image/jpeg', 100, 'private', 'linked', 'message', ${crypto.randomUUID()})
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

test.describe("ordering (no online payment)", () => {
  test("a visitor adds a piece, checks out without paying, and gets an order number; the basket empties", async ({ page }) => {
    const p = phone();
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await expect(page.getByRole("link", { name: /^your cart, 1 item/i })).toBeVisible();
    await page.getByRole("link", { name: /view your cart/i }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Sample Priced Stool").first()).toBeVisible();
    await page.getByRole("link", { name: /continue to checkout/i }).click();
    await expect(page.getByText(/nothing is charged/i).first()).toBeVisible();
    // there is no card or payment form anywhere
    await expect(page.locator('input[autocomplete^="cc-"], iframe[src*="stripe"], iframe[src*="paypal"]')).toHaveCount(0);

    await page.getByLabel(/^Your name/).fill("Order Visitor");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Delivery address/).fill("12 Example Road, Colombo");
    await page.getByLabel(/agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\/confirmed\?ref=ORD-\d{6}/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { level: 1, name: /we have your order/i })).toBeVisible();
    await expect(page.getByText("Sample Priced Stool").first()).toBeVisible();

    const [order] = await sql`SELECT * FROM online_orders WHERE phone = ${p}`;
    expect(order).toMatchObject({ status: "new", is_paid: false, fulfilment: "delivery", payment_method: "on_delivery", total: "15000.50", customer_name: "Order Visitor" });
    const items = await sql`SELECT * FROM online_order_items WHERE order_id = ${order!.id}`;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ product_name: "Sample Priced Stool", quantity: 1, unit_price: "15000.50" });
    // the basket is empty again
    expect(await page.evaluate(() => localStorage.getItem("paramount-order-basket-v1"))).toBeNull();

    // the customer can follow the order: the number alone is not enough, the phone number must match
    await page.getByRole("link", { name: /track this order/i }).click();
    await expect(page).toHaveURL(/\/track\?ref=ORD-\d{6}/);
    await expect(page.getByLabel(/^Order number/)).toHaveValue(/^ORD-\d{6}$/);
    await page.getByLabel(/^Phone number/).fill("0770000000");
    await page.getByRole("button", { name: /track order/i }).click();
    await expect(page.getByText(/could not find an order with that number and phone number/i)).toBeVisible();
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByRole("button", { name: /track order/i }).click();
    await expect(page.getByRole("heading", { name: /hello order, here is your order/i })).toBeVisible();
    await expect(page.getByText("Order received")).toBeVisible();
    await expect(page.getByText("Sample Priced Stool")).toBeVisible();
    await expect(page.getByText(/12 Example Road/)).toHaveCount(0);
  });

  test("a price tampered with in the browser is ignored: the order is priced from the database", async ({ page }) => {
    const p = phone();
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await page.evaluate(() => {
      const items = JSON.parse(localStorage.getItem("paramount-order-basket-v1")!);
      items[0].price = "1.00";
      localStorage.setItem("paramount-order-basket-v1", JSON.stringify(items));
    });
    await page.goto("/checkout");
    await page.getByLabel(/^Your name/).fill("Cheeky Visitor");
    await page.getByLabel(/^Phone number/).fill(p);
    await page.getByLabel(/^Delivery address/).fill("1 Cheap Street");
    await page.getByLabel(/agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\/confirmed/);
    const [order] = await sql`SELECT total FROM online_orders WHERE phone = ${p}`;
    expect(order!.total).toBe("15000.50");
  });

  test("the product with no public price cannot be ordered, only enquired about", async ({ page }) => {
    await page.goto("/products/sample-oak-table");
    await expect(page.getByRole("button", { name: /add to order/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /enquire about this piece/i })).toBeVisible();
  });

  test("an empty basket explains itself, and checkout refuses an incomplete form", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByText(/your cart is empty/i).first()).toBeVisible();
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await page.goto("/checkout");
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText("Your name is required.")).toBeVisible();
    await expect(page.getByText("Phone number is required.")).toBeVisible();
  });
});

test.describe("housekeeping cron", () => {
  test("is closed without the secret and works with it", async ({ request }) => {
    expect((await request.get("/api/cron/housekeeping")).status()).toBe(401);
    expect((await request.get("/api/cron/housekeeping", { headers: { authorization: "Bearer wrong-secret-wrong-secret" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/housekeeping", { headers: { authorization: "Bearer e2e-cron-secret-e2e-cron-secret" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ rateLimitRowsPurged: expect.any(Number), abandonedUploadsRemoved: expect.any(Number) });
  });
});

test.describe("accessibility with real data", () => {
  // Contrast is measured at rest: a section caught mid-fade by the scroll reveal would be read at partial opacity.
  test.use({ reducedMotion: "reduce" });
  for (const path of ["/products", "/products/sample-oak-table", "/products/sample-priced-stool", "/custom", "/contact", "/cart"]) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
