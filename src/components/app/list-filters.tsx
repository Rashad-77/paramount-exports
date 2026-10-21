"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PanelSelect } from "@/components/app/panel-select";
import { TextField } from "@/components/ui/field";

const DEFAULT_SORT_OPTIONS = [
  { value: "latest", label: "Latest first" },
  { value: "oldest", label: "Oldest first" },
];

/**
 * The search, filter and sort panel for the quotation and enquiry lists: the same panel as the order, product and category lists.
 * Changing any box updates the list in place (the address changes, the page does not reload), and the search box keeps its focus.
 * `param` is the name the list uses in its address for the chosen state ("status" or "state").
 */
export function ListFilters({
  action,
  param,
  q,
  value,
  sort,
  placeholder,
  options,
  sortOptions = DEFAULT_SORT_OPTIONS,
}: {
  action: string;
  param: string;
  q?: string;
  /** The chosen state, or "" for all. */
  value: string;
  sort: string;
  placeholder: string;
  /** Every state with its count, the first being "all" (value ""). */
  options: Array<{ value: string; label: string }>;
  /** The sort choices, the first being the default. Latest and oldest first when left out. */
  sortOptions?: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");
  const [chosen, setChosen] = useState(value);
  const [order, setOrder] = useState(sort);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When the address changes from outside (a link, Back), the boxes follow it.
  const key = JSON.stringify([q ?? "", value, sort]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setText(q ?? "");
    setChosen(value);
    setOrder(sort);
  }

  const go = (next: { q: string; value: string; sort: string }) => {
    const u = new URLSearchParams();
    if (next.q.trim()) u.set("q", next.q.trim());
    if (next.value) u.set(param, next.value);
    if (next.sort && next.sort !== sortOptions[0]?.value) u.set("sort", next.sort);
    const qs = u.toString();
    startTransition(() => router.replace(qs ? `${action}?${qs}` : action, { scroll: false }));
  };

  return (
    <div role="search" className="app-filter mb-4 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <TextField
        showOptional={false}
        label="Search"
        type="search"
        maxLength={80}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(() => go({ q: v, value: chosen, sort: order }), 300);
        }}
      />
      <PanelSelect
        label="Filter by"
        quietPlaceholder={false}
        value={chosen}
        options={options}
        onChange={(v) => {
          setChosen(v);
          go({ q: text, value: v, sort: order });
        }}
      />
      <PanelSelect
        label="Sort by"
        quietPlaceholder={false}
        value={order}
        options={sortOptions}
        onChange={(v) => {
          setOrder(v);
          go({ q: text, value: chosen, sort: v });
        }}
      />
    </div>
  );
}
