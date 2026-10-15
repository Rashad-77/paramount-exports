# Project plan: orders-only

## What this system is now

A furniture website where customers can **order online without paying online**, plus a small staff area to handle those orders.
It replaced a larger CRM + ERP-lite (enquiry pipeline, quotations, stock ledger, workshop jobs, purchasing, deliveries, expenses,
after-sales, finance reports) that the business did not need. The old code is in the git history before migration `0015`.

## Decisions

| Question | Decision |
|---|---|
| How does a customer order? | A basket and a checkout. They give name, phone, optional email, delivery address (or choose showroom pickup), and how they plan to pay. |
| Online payment? | **None.** No card, no gateway. Customers pay on delivery, by bank transfer after confirmation, or at the showroom. |
| Who confirms an order? | Staff. A new order is *new* until staff phone or message the customer, agree the **delivery charge**, and confirm it. |
| Who records payment? | Staff, by hand (a paid flag with a timestamp), once the money arrives. The website never marks anything paid. |
| Order statuses | `new → confirmed → in progress → delivered`, or `cancelled` (with a reason) from any open state. Delivered and cancelled are final. |
| Stock? | Not tracked. Products can be ordered if published with a public price. |
| Enquiries and custom requests | Kept as **messages** in a simple inbox (handled / open). A custom request is not an order. |
| Customers | Not a separate record: derived from orders, grouped by phone number. |
| Roles | **Owner** (everything) and **Staff** (orders, messages, customers, products, gallery, website pages). |
| Pricing | The server prices every order from the database. A tampered basket price is ignored (tested). |

## Kept

Public website, catalogue (products, options, categories, photos), gallery, website page wording, staff sign-in and users,
settings (business details and bank details), file uploads (customer pictures on custom requests), anti-spam and rate limits,
audit log, row-level security baseline.

## Removed

Leads/CRM pipeline, follow-ups, quotations and print view, stock, materials, transfers, locations, workshop jobs, suppliers,
purchase orders, goods receipts, deliveries, expenses, after-sales cases, invoicing/payments ledger, reports and CSV export,
the Manager/Sales/Workshop/Finance roles.

## The migration

`drizzle/0015_online_orders_only.sql` drops the old tables (`CASCADE`), their functions, sequences and enum types, removes
`product_variants.inventory_item_id`, adds the `staff` role and deletes role rows for the retired roles, then creates
`online_orders`, `online_order_items` and `messages`. **It destroys the old CRM/ERP data.** Back up before applying it to any
database that holds data you want. The Drizzle snapshot files in `drizzle/meta` were not regenerated for it (the journal was
extended by hand); regenerate them with `drizzle-kit` before the next schema change.

## Possible next phases (not built)

Order emails/SMS to the customer and staff; customer order tracking page; delivery zones with automatic charges; stock counts;
online payment; discount codes; exports to a spreadsheet. None should be added quietly: each changes the promise made on the website.
