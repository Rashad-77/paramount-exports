# Known limitations, assumptions and future phases

Honest list of what is and is not finished. Nothing here is hidden behind a feature that looks complete.

## 1. Not verified against real services

The system was developed and tested against a local PostgreSQL 16 with a stub of Supabase's `auth` schema. These have **not** been run
against a real Supabase project or a real Vercel deployment:

- Supabase sign-in/sign-out and session refresh (`/login`, `proxy.ts`), including multi-factor.
- Supabase Storage uploads and downloads (`pnpm storage:setup`, signed uploads, signed downloads). The local-disk driver is what the tests use.
- `pnpm create-owner` / `pnpm create-user` (they call the Supabase admin API).
- Vercel Cron, the Vercel build, and the GitHub Actions workflow (not re-run since the orders-only change).
- Cloudflare Turnstile (optional; disabled unless keys are set).

Do a rehearsal deployment with test data first (`docs/OPERATIONS.md`).

## 2. The migration is destructive

`drizzle/0015_online_orders_only.sql` drops the old CRM and ERP tables and deletes their data, and deletes role rows for the retired roles.
Applied to a database that still holds that data, **it cannot be undone except from a backup**. Anyone who held a retired role must be
given `owner` or `staff` again afterwards. The Drizzle snapshot files were not regenerated (see `docs/PROJECT_PLAN.md`).

## 3. Assumptions to confirm with the owner

| Assumption | Where |
|---|---|
| Currency **LKR**, time zone **Asia/Colombo**, phone country code **94** | Settings → Business details (the dashboard checklist reminds until the business name is set) |
| A customer can order only an option that has a **price** and whose product has **"show price publicly"** on; otherwise the product page offers an enquiry only | `placeOrder`, product page |
| **Stock is not tracked.** Any published, priced option can be ordered in any quantity (1 to 99 per line, up to 20 lines) | `src/server/orders.ts` |
| The **delivery charge starts at zero** and is agreed with the customer by staff; the total shown to the customer says it excludes delivery | Order screen |
| Showroom **pickup** pairs with "pay at the showroom" or bank transfer; **delivery** pairs with "pay on delivery" or bank transfer | `checkoutSchema` |
| Orders are grouped into a **customer by phone number** (last 9 digits). The same person with two numbers is two customers; two people sharing a number are one | Customers screen |
| Order **rate limits**: 6 orders per address per 10 minutes and 5 per phone number per hour; messages: 5 per address per 10 minutes and 3 per phone number per hour | `src/server/orders.ts`, `messages.ts` |
| An order cannot be reopened once cancelled or delivered, and cannot be edited once finished | `setOrderStatus` |

## 4. Deliberate limits of this version

- **No online payment of any kind.** "Paid" is a flag staff set by hand; the website never reads or stores card or bank details.
- **No notifications.** The customer is not emailed or texted, and staff are not alerted: they see new orders on the dashboard. Customers are told on the confirmation page that staff will call or message them.
- **Order tracking is read-only.** Customers look up an order on `/track` with its number and the phone number they gave (no account). They see the status, items, totals and payment state, never the address or notes. Changing or cancelling an order still means contacting the business and quoting the order number. Lookups are rate limited (15 per address per 10 minutes, 8 per order number per hour).
- **No order editing** after it is placed (items, quantities). Staff cancel it and the customer orders again, or staff note changes in the staff note.
- **No printable invoice or order slip** beyond the browser's Print on the order page.
- **No stock counts**, so nothing stops two customers ordering the last piece. Staff catch this when they confirm.
- **Invites:** people are created by the owner with a script (`pnpm create-user`), not through the app; no password-reset screen beyond what Supabase offers.
- **Gallery, showroom and workshop pictures** on the public pages (the grey frames on the About page, the Gallery filters for showroom and workshop) are fixed in code until real photographs are supplied; only the "Projects" frames come from the admin Gallery.
- **The map** on the Contact page is a stand-in: a map link in Settings makes it clickable; there is no embedded map.
- **The hero videos** (home and gallery) are placeholders until files are set in `src/lib/home-media.ts`.
- **Search** uses simple case-insensitive matching on the main fields; no full-text search.
- **Accessibility:** automated axe checks (WCAG 2.1 A/AA) pass on the public pages including the basket and checkout; keyboard and screen-reader testing was done through the markup only, not with assistive technology. The gallery viewer is a native `<dialog>`.
- **Languages:** English only.
- **Local development:** the project works best outside OneDrive, whose syncing can make the dev server recompile in a loop.

## 5. Out of scope, not added

Online checkout and card payments, a payment gateway, accounting, stock management, quotations and invoices, purchasing and suppliers,
workshop scheduling, deliveries and driver tracking, after-sales cases, expense tracking, a customer portal, multi-currency, multi-branch.
All of these existed in the previous CRM/ERP build and were removed on purpose.

## 6. Suggested next phases

1. Rehearsal deployment and the real-service checks in section 1; enable two-factor for the Owner.
2. Owner review of every assumption in section 3, and of the wording of the checkout, confirmation and legal pages.
3. Email or SMS to the customer (order received, confirmed, delivered) and an alert to staff for new orders.
4. Order-status updates by email or SMS (the tracking page exists; customers must visit it).
5. Delivery zones with automatic charges, if the business has fixed prices.
6. Optional stock counts, if overselling becomes a problem.
