import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-constants";
import type { AccountUpdate } from "@/server/account-updates";

/** Small building blocks shared by the account pages. No client code, so they render on the server. */

export function Pill({ tone, children }: { tone: "info" | "success" | "warning" | "neutral"; children: ReactNode }) {
  return <span className={`st st-${tone}`}>{children}</span>;
}

/** A status as plain small capitals: no box, no colour. Used across the account lists and tables. */
export function StatusText({ children }: { children: ReactNode }) {
  return <span className="acct-status">{children}</span>;
}
export const OrderStatusText = ({ status }: { status: OrderStatus }) => <StatusText>{STATUS_LABEL[status]}</StatusText>;


const ORDER_TONE: Record<OrderStatus, "info" | "success" | "warning" | "neutral"> = { new: "info", confirmed: "warning", in_progress: "warning", ready: "info", out_for_delivery: "warning", delivered: "success", cancelled: "neutral" };
export const OrderStatusPill = ({ status }: { status: OrderStatus }) => <Pill tone={ORDER_TONE[status]}>{STATUS_LABEL[status]}</Pill>;

export function SectionHead({ title, id, link }: { title: string; id?: string; link?: { href: string; label: string } }) {
  return (
    <div className="acct-h">
      <h2 id={id}>{title}</h2>
      {link ? <Link href={link.href}>{link.label}</Link> : null}
    </div>
  );
}

export function Empty({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="acct-empty">
      <p>{children}</p>
      {actions ? <div className="acct-actions">{actions}</div> : null}
    </div>
  );
}

export function Feed({ updates, format }: { updates: AccountUpdate[]; format: (iso: string) => string }) {
  return (
    <ol className="acct-feed">
      {updates.map((u) => (
        <li key={u.id}>
          {u.link ? (
            <Link href={u.link}>
              <strong>{u.title}</strong>
            </Link>
          ) : (
            <strong>{u.title}</strong>
          )}
          {u.body ? <p>{u.body}</p> : null}
          <time dateTime={u.createdAt}>{format(u.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}
