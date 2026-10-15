# Data model

PostgreSQL via Drizzle (`src/lib/db/schema/`). Money is `numeric(14,2)`. Every table has row level security enabled with no policies for
the API roles. SQL migrations are in `drizzle/` (hand-written parts are marked in each file).

## Staff and system

| Table | Notes |
|---|---|
| `profiles` | one row per staff member; `id` = `auth.users.id`; `full_name`, `phone`, `is_active` |
| `user_roles` | `(user_id, role)` unique. Roles in use: `owner`, `staff`. The enum still holds retired values (`manager`, `sales`, `workshop`, `finance`) because Postgres cannot drop enum values; the app ignores them |
| `audit_logs` | append-only (triggers incl. TRUNCATE): actor, action, entity, before/after, reason |
| `site_settings` | key → JSON: `business` (name, tagline, contacts, address, map link, hours, **bank details**, currency, time zone, phone country code) and `pages` (About, Privacy, Terms text) |
| `uploaded_files` | bucket, key, purpose, name, type, size, visibility, status (`quarantined`/`linked`/`purged`), entity |
| `rate_limits` | fixed-window counters keyed by a salted hash (never a raw IP) |

## Catalogue and gallery

| Table | Notes |
|---|---|
| `product_categories` | name, unique slug, order, active, archived |
| `products` | slug, name, description, category, material, finish, dimensions, `is_published`, `is_featured`, `show_price`, `show_availability`, archived |
| `product_variants` | the **options** of a product: SKU (unique), label, `list_price` (nullable), active, order |
| `product_images` | product ↔ uploaded file, alt text, position |
| `gallery_projects` / `gallery_images` | finished projects and their photographs |

A customer can order an option only if the product is published, not archived, `show_price` is on, the option is active and has a price.

## Orders

**`online_orders`**

| Column | Meaning |
|---|---|
| `reference` | `ORD-000001`… (unique, from `next_reference('order')`) |
| `status` | `new` → `confirmed` → `in_progress` → `delivered`, or `cancelled` (needs `cancel_reason`) |
| `customer_name`, `phone`, `phone_key`, `email`, `email_lower` | as typed; `phone_key` = last 9 digits, used to group a customer's orders |
| `fulfilment` | `delivery` (needs `address`) or `pickup` |
| `payment_method` | what the customer plans: `on_delivery`, `bank_transfer`, `at_showroom` |
| `is_paid`, `paid_at` | set **by staff only**, when money is received offline |
| `currency`, `subtotal`, `delivery_charge`, `total` | `total = subtotal + delivery_charge`; delivery charge starts at 0 and is agreed by staff |
| `customer_note`, `staff_note`, `cancel_reason` | text |
| `confirmed_at`, `delivered_at`, `cancelled_at`, `handled_by` | history |

**`online_order_items`**: `order_id`, `position`, `product_id`/`variant_id` (set null if the product is later deleted), and the **copied**
`product_name`, `variant_label`, `sku`, `unit_price`, `quantity` (1 to 99), `line_total`. An order never changes when the catalogue does.

Database checks: amounts are not negative; a cancelled order has a reason; a delivery order has an address; quantities are 1 to 99.

## Messages

**`messages`**: `reference` (`MSG-000001`…), `kind` (`general`, `product_enquiry`, `custom`), `name`, `phone`, `phone_key`, `email`,
`preferred_contact`, `message`, optional `product_id`/`variant_id`, `payload` (JSON: custom-furniture details), `is_handled`, `handled_at`,
`handled_by`. Pictures sent with a custom request are `uploaded_files` rows with `entity_type = 'message'`.

## Customers

There is no customers table. The staff Customers screen is a query over `online_orders` grouped by `phone_key`.

## References

`next_reference(kind)` supports `order` and `message`. Gaps are possible, duplicates are not (sequences).
