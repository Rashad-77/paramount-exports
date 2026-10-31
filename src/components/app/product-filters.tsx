"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { StatusFilter } from "@/components/app/status-filter";
import { CascadeFilter, type CascadeGroup } from "@/components/app/cascade-filter";
import { SelectField, TextField } from "@/components/ui/field";

/**
 * The product list's search and filters. Changing any of them updates the list in place (the address changes, the page does not reload),
 * and the search box keeps its focus while you type.
 */
export function ProductFilters({
  q,
  categoryIds,
  statuses,
  sort,
  sorts,
  categories,
}: {
  q?: string;
  categoryIds: string[];
  statuses: string[];
  sort: string;
  sorts: ReadonlyArray<{ value: string; label: string }>;
  categories: CascadeGroup[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");
  const [category, setCategory] = useState(categoryIds);
  const [status, setStatus] = useState(statuses);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // When the address changes from outside (Clear filters), the boxes follow it.
  const key = JSON.stringify([q ?? "", categoryIds, statuses]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setText(q ?? "");
    setCategory(categoryIds);
    setStatus(statuses);
  }

  const go = (next: { q: string; category: string[]; status: string[]; sort?: string }) => {
    const u = new URLSearchParams();
    if (next.q.trim()) u.set("q", next.q.trim());
    for (const c of next.category) u.append("category", c);
    for (const s of next.status) u.append("status", s);
    const by = next.sort ?? sort;
    if (by !== "name") u.set("sort", by);
    const qs = u.toString();
    startTransition(() => router.replace(qs ? `/app/products?${qs}` : "/app/products", { scroll: false }));
  };

  return (
    <div role="search" className="app-filter mb-4 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <TextField
        showOptional={false}
        label="Search"
        type="search"
        maxLength={80}
        value={text}
        placeholder="Product name"
        onChange={(e) => {
          setText(e.target.value);
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => go({ q: value, category, status }), 300);
        }}
      />
      <CascadeFilter
        label="Category"
        groups={categories}
        selected={category}
        onChange={(ids) => {
          setCategory(ids);
          go({ q: text, category: ids, status });
        }}
      />
      <StatusFilter
        selected={status}
        onChange={(v) => {
          setStatus(v);
          go({ q: text, category, status: v });
        }}
      />
      <SelectField label="Sort by" options={sorts} value={sort} onValueChange={(v) => go({ q: text, category, status, sort: v })} />
    </div>
  );
}
