import Image from "next/image";
import type { orderItems, orderPayments, orders } from "@/lib/db/schema";
import { dec, formatMoney } from "@/lib/money";
import { PAYMENT_LABEL } from "@/lib/order-constants";
import type { BusinessSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import styles from "./receipt.module.css";

type Order = typeof orders.$inferSelect;
type Item = typeof orderItems.$inferSelect;
type Payment = typeof orderPayments.$inferSelect;

export type DocumentMode = "receipt" | "delivery_note";

const METHOD = { cash: "Cash", bank_transfer: "Bank transfer", card: "Card", other: "Other" } as const;

/** The saved address is one line per part, often with trailing commas: join the parts with ", ". */
const oneLine = (text: string | null | undefined) =>
  (text ?? "")
    .split(/[\r\n]+/)
    .map((l) => l.trim().replace(/,+$/, ""))
    .filter(Boolean)
    .join(", ");

/**
 * An order as a printed document, laid out for A4. Three shapes from one order:
 *  - Invoice: while money is still due. Numbered INV-.
 *  - Receipt: once paid. Shows the payment with its receipt number (RCP-).
 *  - Delivery note: no prices; what is being handed over, where to, and a signature line. Cash to collect is shown for pay-on-delivery orders.
 */
export function OrderDocument({ order: o, items, payments, business, mode }: { order: Order; items: Item[]; payments: Payment[]; business: BusinessSettings; mode: DocumentMode }) {
  const tz = business.timezone;
  const money = (v: string | number) => formatMoney(v, o.currency);
  const balance = o.isPaid ? "0" : o.total;
  const cancelled = o.status === "cancelled";
  const delivery = o.fulfilment === "delivery";
  const live = payments.filter((p) => !p.voidedAt);
  const businessAddress = oneLine(business.address);
  const unitsTotal = items.reduce((n, i) => n + i.quantity, 0);
  const hasDiscount = dec(o.discount).gt(0);
  const note = mode === "delivery_note";

  const isReceipt = !note && !cancelled && o.isPaid;
  const title = note ? (delivery ? "Delivery note" : "Collection note") : cancelled ? "Cancelled order" : isReceipt ? "Receipt" : "Invoice";
  const docNumber = note ? o.reference : isReceipt ? (live.length ? live[live.length - 1]!.number : o.reference) : (o.invoiceNumber ?? o.reference);

  const stamp = cancelled
    ? { text: "Cancelled", cls: styles.cancelled, note: o.cancelledAt ? formatDate(o.cancelledAt, tz) : null }
    : o.isPaid
      ? { text: "Paid", cls: styles.paid, note: o.paidAt ? formatDate(o.paidAt, tz) : null }
      : { text: "Unpaid", cls: styles.due, note: null };

  const paymentNote = (() => {
    if (cancelled) return o.cancelReason ? `This order was cancelled: ${o.cancelReason}` : "This order was cancelled.";
    if (o.isPaid) return `Paid${o.paidAt ? ` on ${formatDate(o.paidAt, tz)}` : ""}. Thank you.`;
    const due = money(balance);
    switch (o.paymentMethod) {
      case "on_delivery":
        return `${due} is payable in cash on delivery.`;
      case "at_showroom":
        return `${due} is payable at the showroom when the order is collected.`;
      case "bank_transfer":
        return `${due} is payable by bank transfer. Please quote ${o.reference} as the payment reference.`;
    }
  })();

  return (
    <article className={styles.sheet} aria-label={`${title} ${docNumber}`}>
      <header className={styles.head}>
        <div className={styles.brand}>
          <Image src="/logo-mark.png" alt="" width={44} height={44} />
          <div>
            <div className={styles.brandName}>{business.name}</div>
            {businessAddress ? <div className={`${styles.small} ${styles.muted}`}>{businessAddress}</div> : null}
            <div className={`${styles.small} ${styles.muted}`}>{[business.phone, business.email].filter(Boolean).join("  ·  ")}</div>
          </div>
        </div>
        <div className={styles.docTitle}>
          <h1>{title}</h1>
          <div className={styles.docNo}>No. {docNumber}</div>
          {docNumber !== o.reference ? <div className={`${styles.small} ${styles.muted}`}>Order {o.reference}</div> : null}
        </div>
      </header>

      <section className={styles.info} aria-label="Parties and details">
        <div>
          <p className={styles.label}>{note ? "Customer" : "Billed to"}</p>
          <p>
            <strong>{o.customerName}</strong>
          </p>
          <p>{o.phone}</p>
          {o.email && !note ? <p>{o.email}</p> : null}
        </div>
        <div>
          <p className={styles.label}>{delivery ? "Deliver to" : "Collect from"}</p>
          {delivery ? (
            <p className={styles.pre}>{o.address}</p>
          ) : (
            <>
              <p>
                <strong>{business.name}</strong>
              </p>
              <p>Showroom collection</p>
            </>
          )}
        </div>
        <dl className={styles.facts}>
          <dt>Issued</dt>
          <dd>{formatDate(new Date(), tz)}</dd>
          <dt>Order date</dt>
          <dd>{formatDate(o.createdAt, tz)}</dd>
          <dt>Order type</dt>
          <dd>{delivery ? "Delivery" : "Pickup"}</dd>
          {!note ? (
            <>
              <dt>Payment</dt>
              <dd>{PAYMENT_LABEL[o.paymentMethod]}</dd>
            </>
          ) : null}
          {o.scheduledFor ? (
            <>
              <dt>{delivery ? "Delivery day" : "Collection day"}</dt>
              <dd>{formatDate(o.scheduledFor, "UTC")}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <table className={styles.items}>
        <thead>
          <tr>
            <th className={styles.center} style={{ width: "8%" }}>
              No.
            </th>
            <th>Description</th>
            {note ? null : (
              <th className={styles.num} style={{ width: "17%" }}>
                Unit price
              </th>
            )}
            <th className={styles.center} style={{ width: "8%" }}>
              Qty
            </th>
            {note ? null : (
              <th className={styles.num} style={{ width: "18%" }}>
                Amount
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((i, n) => (
            <tr key={i.id}>
              <td className={styles.center}>{n + 1}</td>
              <td>
                <div className={styles.itemName}>{i.productName}</div>
                {i.variantLabel || i.sku ? <div className={`${styles.small} ${styles.muted}`}>{[i.variantLabel, i.sku].filter(Boolean).join(" · ")}</div> : null}
              </td>
              {note ? null : <td className={styles.num}>{money(i.unitPrice)}</td>}
              <td className={styles.center}>{i.quantity}</td>
              {note ? null : <td className={styles.num}>{money(i.lineTotal)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {note ? (
        <>
          <p style={{ marginTop: 12 }} className={styles.small}>
            Total items: {unitsTotal}
          </p>
          {o.paymentMethod === "on_delivery" && !o.isPaid && !cancelled ? (
            <div className={styles.box} style={{ marginTop: 14 }}>
              <p className={styles.label}>Collect on delivery</p>
              <p>
                <strong>{money(balance)}</strong> in cash.
              </p>
            </div>
          ) : null}
          {o.staffNote || o.customerNote ? (
            <div className={styles.box} style={{ marginTop: 14 }}>
              <p className={styles.label}>Notes</p>
              <p className={styles.pre}>{[o.customerNote, o.staffNote].filter(Boolean).join("\n")}</p>
            </div>
          ) : null}
          <div className={styles.signRow}>
            <div>
              <div className={styles.signLine} />
              <p className={styles.small}>Received in good condition by (name and signature)</p>
            </div>
            <div>
              <div className={styles.signLine} />
              <p className={styles.small}>Date</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.totalsRow}>
            <div className={styles.totals}>
              <div>
                <span className={styles.muted}>Subtotal ({unitsTotal} {unitsTotal === 1 ? "item" : "items"})</span>
                <span>{money(o.subtotal)}</span>
              </div>
              {hasDiscount ? (
                <div>
                  <span className={styles.muted}>Discount{o.discountReason ? ` (${o.discountReason})` : ""}</span>
                  <span>− {money(o.discount)}</span>
                </div>
              ) : null}
              <div>
                <span className={styles.muted}>{delivery ? "Delivery charge" : "Collection"}</span>
                <span>{!delivery ? "No charge" : Number(o.deliveryCharge) > 0 ? money(o.deliveryCharge) : o.deliveryChargeSet || o.isPaid || cancelled ? "No charge" : "To be agreed"}</span>
              </div>
              <div className={styles.grand}>
                <span>Total</span>
                <span>{money(o.total)}</span>
              </div>
              <div>
                <span className={styles.muted}>Amount paid</span>
                <span>{money(o.paidAmount)}</span>
              </div>
              <div className={styles.balance}>
                <span>Balance due</span>
                <span>{money(cancelled ? 0 : balance)}</span>
              </div>
            </div>
          </div>

          {live.length > 0 ? (
            <table className={styles.payTable} aria-label="Payments">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th className={styles.num}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {live.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.number}
                    </td>
                    <td>{formatDate(p.paidAt, tz)}</td>
                    <td>
                      {METHOD[p.method]}
                      {p.reference ? <span className={styles.muted}> · {p.reference}</span> : null}
                    </td>
                    <td className={styles.num}>
                      {money(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <div className={styles.boxes}>
            <div className={styles.box}>
              <p className={styles.label}>Payment</p>
              <p>
                <strong>{PAYMENT_LABEL[o.paymentMethod]}</strong>
              </p>
              <p>{paymentNote}</p>
              {!o.isPaid && !cancelled && o.paymentMethod === "bank_transfer" && business.bankDetails ? (
                <p className={styles.pre} style={{ marginTop: 6 }}>
                  {business.bankDetails}
                </p>
              ) : null}
            </div>
            <div className={styles.box}>
              <p className={styles.label}>Notes</p>
              <p className={styles.pre}>{o.customerNote || "—"}</p>
            </div>
          </div>

          <div className={styles.stampRow}>
            <div className={styles.stampBox}>
              <span className={`${styles.stamp} ${stamp.cls}`}>{stamp.text}</span>
              {stamp.note ? <span className={`${styles.stampDate} ${stamp.cls}`}>{stamp.note}</span> : null}
            </div>
          </div>
        </>
      )}

      <footer className={styles.foot}>
        <p className={styles.thanks}>{note ? "Thank you for your order." : "Thank you for your order."}</p>
        <p className={styles.fine}>
          {[business.name, businessAddress, business.phone, business.email].filter(Boolean).join("  ·  ")}
          <br />
          {note ? "Please check the items on arrival and report any damage the same day." : "This is a computer-generated document and needs no signature. Please keep it as your record of this order. To ask for a refund, please contact us."}
        </p>
      </footer>
    </article>
  );
}
