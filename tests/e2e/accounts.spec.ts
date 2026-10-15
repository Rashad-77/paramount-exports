import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Customer accounts, end to end. They use the built-in test sign-in (ALLOW_LOCAL_CUSTOMER_AUTH, set only for this disposable
 * database), because no Supabase project exists to sign in against. Run one after another: they switch the accounts setting on and off.
 */
const admin = process.env.TEST_ADMIN_DATABASE_URL;
test.skip(!admin, "TEST_ADMIN_DATABASE_URL not set — database-backed e2e tests skipped");
test.describe.configure({ mode: "serial" });

const sql = admin
  ? (() => {
      const u = new URL(admin);
      u.pathname = "/e2e_furniture";
      return postgres(u.toString(), { max: 2, onnotice: () => {} });
    })()
  : (undefined as never);

const setAccounts = (value: Record<string, boolean>) =>
  sql`INSERT INTO site_settings (key, value) VALUES ('accounts', ${sql.json(value)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
const ON = { enabled: true, allowSignUp: true, requiredForCheckout: false, saveCart: true };

// Every test signs up from the same address, which the sign-up limit (a few an hour per connection) would otherwise count together.
test.beforeEach(async () => {
  await sql`DELETE FROM rate_limits`;
});

test.afterAll(async () => {
  await sql?.unsafe(`DELETE FROM site_settings WHERE key = 'accounts'`);
  await sql?.end({ timeout: 2 });
});

let seq = 0;
const unique = () => `${Date.now().toString(36)}${++seq}`;
const phone = () => `0716${String(100000 + Math.floor(Math.random() * 899999))}`;
const PASSWORD = "a long enough password";

async function waitForFormReady(page: Page) {
  await expect(page.locator('input[name="formToken"]').first()).not.toHaveValue("");
  await page.waitForTimeout(3300);
}

async function signUp(page: Page, o: { name?: string; email?: string; phone?: string; next?: string } = {}) {
  const email = o.email ?? `customer-${unique()}@example.com`;
  await page.goto(`/account/sign-in${o.next ? `?next=${encodeURIComponent(o.next)}` : ""}`);
  const form = page.getByRole("region", { name: "Create an account" });
  await form.getByLabel(/^Your name/).fill(o.name ?? "Test Customer");
  await form.getByLabel(/^Email/).fill(email);
  await form.getByLabel(/^Phone number/).fill(o.phone ?? phone());
  await form.getByLabel(/^Password/).fill(PASSWORD);
  await form.getByLabel(/^Type the password again/).fill(PASSWORD);
  await form.getByLabel(/I agree that you keep my details/).check();
  await waitForFormReady(page);
  await form.getByRole("button", { name: /create account/i }).click();
  return email;
}

async function orderStool(page: Page, fillGuest?: { name: string; phone: string }) {
  await page.goto("/products/sample-priced-stool");
  await page.getByRole("button", { name: /add to order/i }).click();
  await expect(page.getByRole("link", { name: /^your cart, 1 item/i })).toBeVisible();
  await page.goto("/checkout");
  if (fillGuest) {
    await page.getByLabel(/^Your name/).fill(fillGuest.name);
    await page.getByLabel(/^Phone number/).fill(fillGuest.phone);
    await page.getByLabel(/^Delivery address/).fill("12 Example Road, Colombo");
  }
  await page.getByLabel(/agree to be contacted/i).check();
  await waitForFormReady(page);
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/confirmed\?ref=ORD-\d{6}/, { timeout: 45_000 });
  return new URL(page.url()).searchParams.get("ref")!;
}

async function freshContext(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test.describe("customer accounts", () => {
  test("while switched off there is nothing to sign in to", async ({ page }) => {
    await sql`DELETE FROM site_settings WHERE key = 'accounts'`;
    // the header button still leads somewhere: a short page that says accounts are not available yet
    expect((await page.goto("/account/sign-in"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /accounts are coming soon/i })).toBeVisible();
    await expect(page.getByRole("form", { name: /sign in/i })).toHaveCount(0);
    expect((await page.goto("/account"))?.status()).toBe(404);
    expect((await (await page.request.get("/api/account/me")).json()).customer).toBeNull();
  });

  test("a customer creates an account, orders while signed in, and finds the order on their account", async ({ page }) => {
    await setAccounts(ON);
    const name = "Kamala Fernando";
    const p = phone();
    const email = await signUp(page, { name, phone: p });
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: /hello, kamala/i })).toBeVisible();

    // the checkout form is pre-filled from the account
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await page.goto("/checkout");
    await expect(page.getByLabel(/^Your name/)).toHaveValue(name);
    await expect(page.getByLabel(/^Phone number/)).toHaveValue(p);
    await page.getByLabel(/^Delivery address/).fill("12 Example Road, Colombo");
    await page.getByLabel(/agree to be contacted/i).check();
    await waitForFormReady(page);
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\/confirmed\?ref=ORD-\d{6}/, { timeout: 45_000 });
    const ref = new URL(page.url()).searchParams.get("ref")!;

    const [order] = await sql`SELECT o.account_id, a.email FROM online_orders o JOIN customer_accounts a ON a.id = o.account_id WHERE o.reference = ${ref}`;
    expect(order?.email).toBe(email);

    await page.goto("/account/orders");
    await expect(page.getByRole("link", { name: ref })).toBeVisible();
    await page.getByRole("link", { name: ref }).click();
    await expect(page.getByText("Sample Priced Stool").first()).toBeVisible();
    await expect(page.getByText("Order received")).toBeVisible();
  });

  test("one customer can never open another customer's order, and a guest is sent to sign in", async ({ page, browser }) => {
    await setAccounts(ON);
    await signUp(page, { name: "Owner Of Order" });
    await expect(page).toHaveURL(/\/account$/);
    const ref = await orderStool(page, { name: "Owner Of Order", phone: phone() });

    const other = await freshContext(browser);
    await signUp(other.page, { name: "Someone Else" });
    await expect(other.page).toHaveURL(/\/account$/);
    expect((await other.page.goto(`/account/orders/${ref}`))?.status()).toBe(404);
    await other.ctx.close();

    const guest = await freshContext(browser);
    await guest.page.goto(`/account/orders/${ref}`);
    await expect(guest.page).toHaveURL(/\/account\/sign-in\?next=/);
    await guest.ctx.close();
  });

  test("an earlier guest order can be added with its number and phone, and nothing else", async ({ page, browser }) => {
    await setAccounts(ON);
    const guestPhone = phone();
    const guest = await freshContext(browser);
    await setAccounts({ ...ON, enabled: false });
    const ref = await orderStool(guest.page, { name: "Guest Buyer", phone: guestPhone });
    await guest.ctx.close();
    await setAccounts(ON);

    await signUp(page, { name: "Guest Buyer" });
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/account/orders");
    const claim = page.getByRole("region", { name: /add an earlier order/i });
    await claim.getByLabel(/^Order number/).fill(ref);
    await claim.getByLabel(/^Phone number/).fill("0770000000");
    await claim.getByRole("button", { name: /add this order/i }).click();
    await expect(page.getByText(/could not find an order with that number and phone number/i)).toBeVisible();
    await claim.getByLabel(/^Phone number/).fill(guestPhone);
    await claim.getByRole("button", { name: /add this order/i }).click();
    await expect(page.getByText(new RegExp(`${ref} has been added`))).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: ref })).toBeVisible();
  });

  test("signing in: a wrong password is refused with one message; the right one works; signing out ends the session", async ({ page }) => {
    await setAccounts(ON);
    const email = await signUp(page);
    await expect(page).toHaveURL(/\/account$/);
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await expect(page).toHaveURL(/\/$/);
    expect((await (await page.request.get("/api/account/me")).json()).customer).toBeNull();

    await page.goto("/account/sign-in");
    const form = page.getByRole("region", { name: "I have an account" });
    await form.getByLabel(/^Email/).fill(email);
    await form.getByLabel(/^Password/).fill("not the password");
    await form.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible();
    await form.getByLabel(/^Email/).fill("nobody-here@example.com");
    await form.getByLabel(/^Password/).fill(PASSWORD);
    await form.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page.getByText("Incorrect email or password.")).toBeVisible(); // identical for an unknown email

    await form.getByLabel(/^Email/).fill(email);
    await form.getByLabel(/^Password/).fill(PASSWORD);
    await form.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("sign-up checks every field and keeps what was typed", async ({ page }) => {
    await setAccounts(ON);
    await page.goto("/account/sign-in");
    const form = page.getByRole("region", { name: "Create an account" });
    await form.getByLabel(/^Your name/).fill("Half Done");
    await form.getByLabel(/^Email/).fill("not-an-email");
    await form.getByLabel(/^Password/).fill("short");
    await form.getByLabel(/^Type the password again/).fill("different");
    await waitForFormReady(page);
    await form.getByRole("button", { name: /create account/i }).click();
    await expect(form.getByText(/enter a valid email address/i)).toBeVisible();
    await expect(form.getByText(/use at least 8 characters/i)).toBeVisible();
    await expect(form.getByText(/do not match/i)).toBeVisible();
    await expect(form.getByText(/please agree/i)).toBeVisible();
    await expect(form.getByLabel(/^Your name/)).toHaveValue("Half Done");
    await expect(form.getByLabel(/^Password/)).toHaveValue(""); // passwords are never echoed back
  });

  test("details can be saved, a wrong current password is refused, and deleting the account unlinks but keeps the orders", async ({ page }) => {
    await setAccounts(ON);
    const email = await signUp(page, { name: "To Be Deleted" });
    await expect(page).toHaveURL(/\/account$/);
    const ref = await orderStool(page, { name: "To Be Deleted", phone: phone() });

    await page.goto("/account/profile");
    await page.getByLabel(/^Full name/).fill("Renamed Customer");
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/your details are saved/i)).toBeVisible();
    await expect.poll(async () => (await sql`SELECT full_name FROM customer_accounts WHERE email_lower = ${email.toLowerCase()}`)[0]?.full_name).toBe("Renamed Customer");

    await page.goto("/account/security");
    await page.getByLabel(/^Current password/).fill("wrong password!");
    await page.getByLabel(/^New password/).fill("another long password");
    await page.getByLabel(/^Type it again/).fill("another long password");
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(page.getByText(/not your current password|current password is not right/i).first()).toBeVisible();

    await page.getByLabel(/^Type your email address to confirm/).fill("someone-else@example.com");
    await page.getByRole("button", { name: /delete my account/i }).click();
    await expect(page.getByText(/not the email address on this account/i).first()).toBeVisible();
    await page.getByLabel(/^Type your email address to confirm/).fill(email);
    await page.getByRole("button", { name: /delete my account/i }).click();
    await expect(page).toHaveURL(/\/\?notice=account-deleted|\/$/);

    expect(await sql`SELECT 1 FROM customer_accounts WHERE email_lower = ${email.toLowerCase()}`).toHaveLength(0);
    const [order] = await sql`SELECT account_id FROM online_orders WHERE reference = ${ref}`;
    expect(order).toBeDefined();
    expect(order!.account_id).toBeNull();
  });

  test("when the owner requires accounts, guests are asked to sign in before ordering", async ({ page }) => {
    await setAccounts({ ...ON, requiredForCheckout: true });
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: /sign in to place your order/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /place order/i })).toHaveCount(0);
    await page.getByRole("link", { name: /sign in or create an account/i }).click();
    await expect(page).toHaveURL(/\/account\/sign-in\?next=(%2F|\/)checkout/);

    // signing up from here comes straight back to the checkout, where the form is now available
    await signUp(page, { next: "/checkout" });
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible();
  });

  test("the saved basket follows the customer to another browser", async ({ page, browser }) => {
    await setAccounts(ON);
    const email = await signUp(page);
    await expect(page).toHaveURL(/\/account$/);
    await page.goto("/products/sample-priced-stool");
    await page.getByRole("button", { name: /add to order/i }).click();
    await expect.poll(async () => (await sql`SELECT jsonb_array_length(c.items) AS n FROM customer_carts c JOIN customer_accounts a ON a.id = c.account_id WHERE a.email_lower = ${email.toLowerCase()}`)[0]?.n, { timeout: 15_000 }).toBe(1);

    const second = await freshContext(browser);
    await second.page.goto("/account/sign-in");
    const form = second.page.getByRole("region", { name: "I have an account" });
    await form.getByLabel(/^Email/).fill(email);
    await form.getByLabel(/^Password/).fill(PASSWORD);
    await form.getByRole("button", { name: /^sign in$/i }).click();
    await expect(second.page).toHaveURL(/\/account$/);
    await expect(second.page.getByRole("link", { name: /^your cart, 1 item/i })).toBeVisible({ timeout: 15_000 });
    await second.ctx.close();
  });

  test("no serious accessibility problems on the sign-in and account pages", async ({ page }) => {
    await setAccounts(ON);
    // Colours are measured on the finished page, not part-way through a fade-in.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/account/sign-in");
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    await signUp(page);
    await expect(page).toHaveURL(/\/account$/);
    for (const path of ["/account", "/account/quotations", "/account/orders", "/account/wishlist", "/account/profile", "/account/addresses", "/account/security"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Your account" })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    }
  });
});
