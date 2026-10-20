import { Bell, CheckCheck, CircleCheck, CircleX, Package, Truck, Undo2, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Fulfilment, OrderStatus } from "@/lib/order-constants";
import { STATUS_LABEL } from "@/lib/order-constants";
import type { PaymentState } from "@/lib/order-flow";
import { STAFF_QUOTE_LABEL, type QuoteStatus } from "@/lib/quotation-ui";

export type TagColor = "blue" | "yellow" | "teal" | "amber" | "purple" | "orange" | "green" | "red" | "grey";

/** A status tag: a soft tinted box with a coloured icon and the word. Every stage has its own colour and icon, so none is mistaken for another. */
export function Tag({ color, icon: Icon, children }: { color: TagColor; icon: LucideIcon; children: ReactNode }) {
  return (
    <span className={`tag tag-${color}`}>
      <Icon aria-hidden="true" strokeWidth={2} />
      {children}
    </span>
  );
}

const ORDER: Record<OrderStatus, { color: TagColor; icon: LucideIcon }> = {
  new: { color: "yellow", icon: Bell },
  confirmed: { color: "teal", icon: CircleCheck },
  in_progress: { color: "teal", icon: CircleCheck },
  ready: { color: "purple", icon: Package },
  out_for_delivery: { color: "orange", icon: Truck },
  delivered: { color: "green", icon: CheckCheck },
  cancelled: { color: "red", icon: CircleX },
};

export function OrderTag({ status, isPaid = false, fulfilment = "delivery" }: { status: OrderStatus; isPaid?: boolean; fulfilment?: Fulfilment }) {
  const displayStatus = status === "in_progress" ? "confirmed" : status;
  const { color, icon } = ORDER[displayStatus];
  const label = status === "delivered" && !isPaid
    ? fulfilment === "pickup" ? "Collected" : "Delivered"
    : STATUS_LABEL[displayStatus];
  return (
    <Tag color={color} icon={icon}>
      {label}
    </Tag>
  );
}

const PAYMENT_TAG: Record<PaymentState, { color: TagColor; icon: LucideIcon; label: string }> = {
  unpaid: { color: "red", icon: Wallet, label: "Not paid" },
  part: { color: "amber", icon: Wallet, label: "Part paid" },
  paid: { color: "green", icon: Wallet, label: "Paid" },
  refunded: { color: "grey", icon: Undo2, label: "Refunded" },
  part_refunded: { color: "purple", icon: Undo2, label: "Part refunded" },
};

/** The payment tag for an order's money: not paid, part paid, paid, refunded or part refunded. */
export function PaymentTag({ state }: { state: PaymentState }) {
  const { color, icon, label } = PAYMENT_TAG[state];
  return (
    <Tag color={color} icon={icon}>
      {label}
    </Tag>
  );
}

export function PaidTag({ paid }: { paid: boolean }) {
  return paid ? (
    <Tag color="green" icon={Wallet}>
      Paid
    </Tag>
  ) : (
    <Tag color="red" icon={Wallet}>
      Not paid
    </Tag>
  );
}

export function QuoteTag({ status }: { status: QuoteStatus }) {
  return status === "requested" ? (
    <Tag color="yellow" icon={Bell}>
      {STAFF_QUOTE_LABEL[status]}
    </Tag>
  ) : (
    <Tag color="green" icon={CheckCheck}>
      {STAFF_QUOTE_LABEL[status]}
    </Tag>
  );
}

export function EnquiryTag({ state }: { state: "new" | "responded" }) {
  return state === "responded" ? (
    <Tag color="green" icon={CheckCheck}>
      Responded
    </Tag>
  ) : (
    <Tag color="yellow" icon={Bell}>
      New
    </Tag>
  );
}
