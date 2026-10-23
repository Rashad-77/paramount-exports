# Acceptance tests

The flows the system must keep working, and the automated test behind each. Database tests are in `tests/integration/*.db.test.ts`
(they need `TEST_ADMIN_DATABASE_URL`), browser tests in `tests/e2e/*.spec.ts` (run against a production build).

| # | Flow | Test |
|---|---|---|
| 1 | A visitor adds a priced piece to the basket; the header shows the count | e2e `ordering › a visitor adds a piece…` |
| 2 | They check out **without paying** (no card field, no payment iframe) and get an order number `ORD-nnnnnn`; the basket empties; the confirmation shows what they ordered | e2e `ordering › a visitor adds a piece…` |
| 3 | The order is stored as `new`, unpaid, with the price **read from the database** | `orders.db` `places an order priced from the database…`; e2e |
| 4 | A price changed in the browser is ignored | `orders.db` `never trusts a price…`; e2e `price tampered with…` |
| 5 | Hidden, unpublished, unpriced or unknown items cannot be ordered; repeated lines merge | `orders.db` |
| 6 | The checkout requires an address for delivery, sensible payment choices, and quantities 1 to 99 | `orders.db` `validates the checkout…`; e2e `checkout refuses an incomplete form` |
| 7 | An order keeps its names and prices when the catalogue changes later | `orders.db` `keeps its prices and names…` |
| 8 | Orders from one address or phone number are rate limited | `orders.db` `limits how many orders…` |
| 9 | Staff move an order new → confirmed → in progress → delivered; impossible moves are refused; every step is audited | `orders.db` `moves an order through its statuses…` |
| 10 | Cancelling needs a reason and cannot be undone; a cancelled order cannot be marked paid | `orders.db` `cancelling needs a reason…` |
| 11 | The delivery charge changes the total; payment is recorded once, can be undone, and is audited | `orders.db` `recalculates the total…` |
| 12 | A finished order cannot be edited | `orders.db` `a finished order cannot be edited` |
| 13 | Orders can be searched and filtered, counted by status; a `%` search matches nothing | `orders.db` `filters and searches orders…` |
| 14 | Customers are built from orders by phone number, with history | `orders.db` `builds a customer list…` |
| 15 | The dashboard summarises orders, messages and the last 30 days | `orders.db` `summarises the dashboard` |
| 16 | A product with no public price cannot be ordered, only enquired about | e2e `no public price cannot be ordered` |
| 17 | A contact message, a product enquiry and a custom request (with a picture) reach the staff inbox; staff mark them handled and reopen them | `orders.db` (messages); e2e `enquiries` |
| 18 | Spam: honeypot, too-fast, forged token and rate limits store nothing | e2e `enquiries`; `orders.db` |
| 19 | Only Owner and Staff can see or change orders, messages and customers; people with no role or a switched-off account are refused | `orders.db`; `catalogue.db`; `permissions.test` |
| 20 | Only the Owner manages users and settings; there is always an active owner | `users.db`; `permissions.test` |
| 21 | Signed-out visitors are sent to sign in from every staff page; the old CRM and ERP screens no longer exist | e2e `access control` |
| 22 | Private files are not downloadable by the public | e2e `access control for files and staff data` |
| 23 | Migrations apply to a clean database, leave the order tables and none of the retired tables, and every table has row level security | `foundation.db` |
| 24 | Public pages (including basket and checkout) have no serious accessibility violations; no sideways scroll on a phone | e2e `accessibility` |

Manual checks that are not automated: the layout and animation of each page in a real browser at phone and desktop widths; the staff
screens' appearance; sending a real email or text (none is sent by the system).
