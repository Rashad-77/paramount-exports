"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const STATUS_OPTIONS = [
  ["new", "New"],
  ["confirmed", "Confirmed"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;
const PAYMENT_OPTIONS = [
  ["paid", "Paid"],
  ["unpaid", "Not paid"],
] as const;

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
  const [pending, start] = useTransition();
  const [selectedStatuses, setSelectedStatuses] = useState(statuses);
  const [selectedPayments, setSelectedPayments] = useState(payments);

  // When the address changes from outside (Clear filters, a link), the boxes follow it.
  const key = JSON.stringify([statuses, payments]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setSelectedStatuses(statuses);
    setSelectedPayments(payments);
  }

  const toggle = (list: string[], value: string, setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };
  const apply = (nextStatuses = selectedStatuses, nextPayments = selectedPayments) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (sort) query.set("sort", sort);
    if (nextStatuses.length) query.set("statuses", nextStatuses.join(","));
    if (nextPayments.length) query.set("payments", nextPayments.join(","));
    const search = query.toString();
    start(() => router.replace(search ? `${action}?${search}` : action, { scroll: false }));
  };
  const count = selectedStatuses.length + selectedPayments.length;

  return (
    <div className="relative flex min-w-40 shrink-0 flex-col gap-1 pb-1 text-xs text-text-muted">
      <span>Filter by</span>
      <details className="group relative w-full">
        <summary
          className="flex min-h-9 w-full cursor-pointer list-none items-center justify-between gap-2 border border-border-strong bg-surface px-2.5 text-sm text-text hover:bg-paper-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-walnut [&::-webkit-details-marker]:hidden"
          aria-label="Filter orders by status and payment"
        >
          <span>{count ? `Selected (${count})` : "All filters"}</span>
          <span aria-hidden="true" className="text-xs">▾</span>
        </summary>
        <div className="absolute right-0 top-full z-30 mt-1 w-64 border border-border bg-surface p-3 shadow-lg">
        <fieldset className="border-b border-border pb-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Status</legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {STATUS_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={selectedStatuses.includes(value)}
                  onChange={() => toggle(selectedStatuses, value, setSelectedStatuses)}
                  className="size-3.5 accent-[var(--color-walnut)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="pt-3">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Payment</legend>
          <div className="flex gap-4">
            {PAYMENT_OPTIONS.map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={selectedPayments.includes(value)}
                  onChange={() => toggle(selectedPayments, value, setSelectedPayments)}
                  className="size-3.5 accent-[var(--color-walnut)]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              setSelectedStatuses([]);
              setSelectedPayments([]);
              apply([], []);
            }}
            disabled={pending || count === 0}
            className="text-xs text-text-muted underline hover:text-text disabled:opacity-50"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={() => apply()}
            disabled={pending}
            className="min-h-8 bg-charcoal px-3 text-xs text-white hover:bg-walnut disabled:opacity-60"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
        </div>
        </div>
      </details>
    </div>
  );
}
