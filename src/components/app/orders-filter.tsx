"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PanelSelect } from "@/components/app/panel-select";
import { StatusFilter } from "@/components/app/status-filter";
import { TextField } from "@/components/ui/field";

const ORDER_GROUPS = [
  {
    label: "Order status",
    items: [
      { value: "new", label: "New" },
      { value: "confirmed", label: "Confirmed" },
      { value: "ready", label: "Ready" },
      { value: "delivered", label: "Delivered" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
  {
    label: "Payment",
    items: [
      { value: "paid", label: "Paid" },
      { value: "unpaid", label: "Not paid" },
    ],
  },
];
const PAYMENT_VALUES = new Set(["paid", "unpaid"]);

const SORT_OPTIONS = [
  { value: "latest", label: "Latest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "total_desc", label: "Total: high to low" },
  { value: "total_asc", label: "Total: low to high" },
];

/**
 * The order list's search, filter and sort, in the same panel as the product and category lists. Changing any of them updates the list in
 * place (the address changes, the page does not reload), and the search box keeps its focus while you type.
 */
export function OrdersFilter({
  action,
  q,
  sort,
  statuses,
  payments,
}: {
  action: string;
  q?: string;
  sort: string;
  statuses: string[];
  payments: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");
  const [picked, setPicked] = useState([...statuses, ...payments]);
  const [order, setOrder] = useState(sort);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When the address changes from outside (Clear filters, a link), the boxes follow it.
  const key = JSON.stringify([q ?? "", statuses, payments, sort]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setText(q ?? "");
    setPicked([...statuses, ...payments]);
    setOrder(sort);
  }

  const go = (next: { q: string; picked: string[]; sort: string }) => {
    const u = new URLSearchParams();
    if (next.q.trim()) u.set("q", next.q.trim());
    const st = next.picked.filter((v) => !PAYMENT_VALUES.has(v));
    const pay = next.picked.filter((v) => PAYMENT_VALUES.has(v));
    if (st.length) u.set("statuses", st.join(","));
    if (pay.length) u.set("payments", pay.join(","));
    if (next.sort && next.sort !== "latest") u.set("sort", next.sort);
    const qs = u.toString();
    startTransition(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  };

  return (
    <div role="search" className="app-filter mb-4 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <TextField
        showOptional={false}
        label="Search"
        type="search"
        value={text}
        placeholder="Order or invoice number, name, phone or email"
        onChange={(e) => {
          setText(e.target.value);
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => go({ q: value, picked, sort: order }), 300);
        }}
      />
      <StatusFilter
        selected={picked}
        groups={ORDER_GROUPS}
        label="Filter by"
        emptyLabel="All orders"
        onChange={(v) => {
          setPicked(v);
          go({ q: text, picked: v, sort: order });
        }}
      />
      <PanelSelect
        label="Sort by"
        quietPlaceholder={false}
        value={order}
        options={SORT_OPTIONS}
        onChange={(v) => {
          setOrder(v);
          go({ q: text, picked, sort: v });
        }}
      />
    </div>
  );
}
