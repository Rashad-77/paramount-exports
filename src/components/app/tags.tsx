import { Bell, CheckCheck, CircleCheck, CircleX, Hammer, Package, Truck, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { OrderStatus } from "@/lib/order-constants";
import { STATUS_LABEL } from "@/lib/order-constants";
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
  in_progress: { color: "amber", icon: Hammer },
  ready: { color: "purple", icon: Package },
  out_for_delivery: { color: "orange", icon: Truck },
  delivered: { color: "green", icon: CheckCheck },
  cancelled: { color: "red", icon: CircleX },
};

export function OrderTag({ status }: { status: OrderStatus }) {
  const { color, icon } = ORDER[status];
  return (
    <Tag color={color} icon={icon}>
      {STATUS_LABEL[status]}
    </Tag>
  );
}

export function PaidTag({ paid }: { paid: boolean }) {
  return paid ? (
    <Tag color="green" icon={Wallet}>
      Paid
    </Tag>
  ) : (
    <Tag color="amber" icon={Wallet}>
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
