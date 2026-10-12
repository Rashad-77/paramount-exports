# Data Model (proposal v1)

Conventions: `id uuid` PK (`gen_random_uuid()`); `created_at`, `updated_at timestamptz`; money `numeric(14,2)`;
quantities `numeric(14,3)`; enums as Postgres enums or `text` + `CHECK`; business records use `archived_at` (soft archive),
**financial and inventory rows are never deleted**. Every table has RLS enabled with no policies for `anon`/`authenticated`.
Tables are introduced by milestone — only those needed by a step are migrated in that step.

## Step 1 — Foundation

| Table | Purpose / key columns |
|---|---|
| `profiles` | `id` = `auth.users.id`, `full_name`, `phone`, `is_active`, timestamps |
| `user_roles` | `user_id → profiles`, `role` (owner/manager/sales/workshop/finance), `granted_by`; unique(user_id, role) |
| `audit_logs` | `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `request_id`, `created_at` (insert-only trigger) |
| `site_settings` | key/value jsonb: business name, logo file, address, hours, phones, WhatsApp, currency, timezone, policies |
| `locations` | `name`, `kind` (showroom/workshop/warehouse), `is_active`; seeded: one showroom, one workshop |
| `document_sequences` | Postgres sequences `seq_quotation`, `seq_order`, `seq_job`, `seq_po`, … + `next_reference(kind)` function |
| `uploaded_files` | `bucket`, `object_key`, `purpose` (enquiry, catalogue, gallery, …; decides who may upload and what is accepted), `original_name`, `content_type`, `size_bytes`, `visibility`, `uploaded_by`, `entity_type`, `entity_id`, `status` (quarantined/linked/purged) |
| `rate_limits` | `key_hash`, `window_start`, `count` — public form throttling |

## Step 2/3 — CRM & quotations

| Table | Key columns / relationships |
|---|---|
| `customers` | `name`, `company`, `phone`, `phone_normalised`, `email`, `email_lower`, `address`, `preferred_contact`, `notes`, `archived_at`; indexes on normalised phone/email (non-unique: duplicates are warned, not blocked) |
| `leads` | `reference` (ENQ-), `preferred_contact`, contact snapshot (name/phone/email) so public enquiries never create customers automatically, `customer_id?`, `source` enum, `status` pipeline enum, `assigned_to`, `next_follow_up_on`, `lost_reason`, `kind` (general/custom/product_enquiry), `product_id?`, `payload jsonb` (custom spec as submitted), `possible_duplicate_customer_id?` |
| `lead_activities` | `lead_id`, `customer_id`, `type` (call/meeting/showroom_visit/message/note/status_change), `body`, `created_by`, `occurred_at` |
| `follow_up_tasks` | `lead_id?`, `customer_id?`, `assigned_to`, `due_on`, `completed_at`, `title`; overdue = due_on < today AND completed_at IS NULL (computed) |
| `quotations` | `reference`, `customer_id`, `lead_id?`, `status` (draft/sent/accepted/rejected/expired/converted), `current_revision`, `valid_until`, `currency`, `created_by`; accepted revision is immutable |
| `quotation_revisions` | `quotation_id`, `revision_no`, snapshot header: `delivery_charge`, `discount_total`, `subtotal`, `total`, `terms`, `notes`, `sent_at`; unique(quotation_id, revision_no) |
| `quotation_items` | `revision_id`, `position`, `kind` (ready_made/custom), `product_variant_id?`, `description`, `specification jsonb` (dimensions/material/finish), `quantity`, `unit_price`, `discount_amount`, `line_total` |

## Step 4 — Products, inventory, sales

| Table | Notes |
|---|---|
| `product_categories` | `name`, `slug`, `parent_id?`, `sort_order`, `is_active` |
| `products` | `slug`, `name`, `description`, `category_id`, `kind` (stocked/made_to_order), `material`, `finish`, `dimensions` (free text as shown to customers), `is_published`, `is_featured`, `show_price` and `show_availability` (+ `availability`) — both **off by default** so nothing is shown publicly unless approved, `seo_title/description` |
| `product_variants` | `product_id`, `sku` unique, `label` (size/finish), `list_price`, `inventory_item_id?`, `is_active` |
| `product_images` | `product_id`, `file_id`, `alt_text`, `position` |
| `inventory_items` | `kind` (finished_good/raw_material/consumable), `sku`, `name`, `unit`, `cost_price?`, `is_active`; finished goods link from `product_variants.inventory_item_id` |
| `inventory_balances` | PK(item_id, location_id): `on_hand`, `reserved`, `low_stock_threshold`; CHECKs: on_hand ≥ 0, reserved ≥ 0, reserved ≤ on_hand |
| `inventory_movements` | **immutable ledger**: `item_id`, `location_id`, `type` (opening, receipt, sale, reserve, release, transfer_out, transfer_in, production_consume, production_output, waste, adjustment), `on_hand_delta`, `reserved_delta`, `reason`, `ref_type`, `ref_id`, `actor_id`, `created_at`. Trigger forbids UPDATE/DELETE |
| `stock_transfers` | `from_location`, `to_location`, `status`, `note`; each transfer produces a paired out/in movement in one transaction |
| `stock_reservations` | `order_item_id`, `item_id`, `location_id`, `quantity`, `status` (active/fulfilled/released) — links reservation movements to order lines |
| `sales_orders` | `reference`, `customer_id`, `quotation_id?`, `type` (ready_made/custom), `status`, `subtotal`, `discount_total`, `delivery_charge`, `total`, `agreed_price`, `deposit_terms`, `requested_completion_date`, `location_id` |
| `sales_order_items` | `order_id`, `variant_id?`, `description`, `specification jsonb`, `quantity`, `unit_price`, `discount_amount`, `line_total` |
| `payments` | `order_id`, `amount`, `method`, `paid_at`, `reference`, `recorded_by`, `voided_by?`, `voids_payment_id?`; outstanding = order total − Σ(non-voided) |

## Step 5 — Workshop & purchasing

| Table | Notes |
|---|---|
| `production_jobs` | `reference`, `order_id`, `quotation_id?`, `customer_id`, `description`, `specification jsonb`, `priority`, `target_date`, `stage`, `assigned_to`, `completed_at` |
| `production_stage_history` | `job_id`, `from_stage`, `to_stage`, `changed_by`, `note`, `changed_at` |
| `production_issues` | delays / rework notes per job |
| `bills_of_materials`, `bom_items` | planned materials per product or job: `item_id`, `planned_qty`, `estimated_unit_cost` |
| `material_consumption` | `job_id`, `item_id`, `location_id`, `quantity`, `waste_quantity`, `movement_id` (unique per consumption record → no double deduction) |
| `labour_entries` | optional manual labour cost per job |
| `suppliers` | contact details, supplied materials, notes |
| `purchase_orders` / `purchase_order_items` | `reference`, `supplier_id`, `status`, `expected_on`, qty ordered, expected unit cost, supplier invoice ref/amount/paid |
| `goods_receipts` / `goods_receipt_items` | received qty per PO line → `receipt` movements; remaining = ordered − Σ received |

## Step 6 — Delivery, expenses, after-sales

`deliveries` (order, address, contact, window, fee, assignee, status, proof note/file) · `expenses` (date, category, amount, note, file) ·
`expense_categories` · `after_sales_cases` (customer, order, type warranty/repair/complaint, status, dates, notes).

## Key relationships

`customer 1─* lead`, `customer 1─* quotation 1─* revision 1─* item`, `quotation 1─0..1 sales_order`,
`order 1─* order_item`, `order 1─* payment`, `order(custom) 1─1 production_job`, `job 1─* consumption ─ 1 movement`,
`product 1─* variant 0..1─ inventory_item *─* location (balances)`, `PO 1─* receipt 1─* receipt_item ─ movement`.

## Integrity rules enforced in the database

- Immutable ledger and audit log (triggers).
- Balance CHECK constraints; unique reference numbers; unique `material_consumption.movement_id`.
- Accepted/converted quotation revisions immutable (trigger); status transitions validated in the service layer and constrained by enums.
- Money ≥ 0 CHECKs where applicable; payments positive; void rows reference the original.
- FKs `ON DELETE RESTRICT` for business records.

## Archive / deletion policy

Customers, products, suppliers, locations: archive (hide), never hard-delete once referenced. Orders: cancel, never delete.
Payments, movements, audit logs: append-only. Uploaded files: marked `purged` after retention rules, metadata retained.

## Security baseline (every migration)

Each migration that adds tables or functions ends with `SELECT enforce_rls();` (defined in `0002`). It enables RLS on every public table, removes table/sequence privileges from `anon`/`authenticated`, and — importantly — revokes `EXECUTE` on every function from `PUBLIC` (Postgres grants it by default, and `anon` inherits it, which would expose functions as RPC endpoints). Tests assert all three for every table and function.

## Quotation immutability

`quotation_revisions.frozen_at` is set when a quotation is sent. Database triggers (`forbid_frozen_revision_change`, `forbid_frozen_item_change`) then refuse any UPDATE/DELETE of that revision and any INSERT/UPDATE/DELETE of its items — so a sent version can only be superseded by a new revision, whatever code (or manual SQL) tries. Tests assert this with raw SQL.
