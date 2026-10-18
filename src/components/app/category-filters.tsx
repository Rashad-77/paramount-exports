"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CascadeFilter, type CascadeGroup } from "@/components/app/cascade-filter";
import { StatusFilter } from "@/components/app/status-filter";
import { TextField } from "@/components/ui/field";

const CATEGORY_STATUS_GROUPS = [
  {
    label: "Visibility",
    items: [
      { value: "visible", label: "Visible" },
      { value: "hidden", label: "Hidden" },
      { value: "archived", label: "Archived" },
    ],
  },
];

/**
 * The category list's search and filters. Changing any of them updates the list in place (the address changes, the page does not
 * reload), and the search box keeps its focus while you type.
 */
export function CategoryFilters({
  q,
  categoryIds,
  statuses,
  categories,
}: {
  q?: string;
  categoryIds: string[];
  statuses: string[];
  categories: CascadeGroup[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");
  const [grp, setGrp] = useState(categoryIds);
  const [status, setStatus] = useState(statuses);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When the address changes from outside (Clear filters), the boxes follow it.
  const key = JSON.stringify([q ?? "", categoryIds, statuses]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setText(q ?? "");
    setGrp(categoryIds);
    setStatus(statuses);
  }

  const go = (next: { q: string; group: string[]; status: string[] }) => {
    const u = new URLSearchParams();
    if (next.q.trim()) u.set("q", next.q.trim());
    for (const c of next.group) u.append("category", c);
    for (const s of next.status) u.append("status", s);
    const qs = u.toString();
    startTransition(() => router.replace(qs ? `/app/categories?${qs}` : "/app/categories", { scroll: false }));
  };

  return (
    <div role="search" className="app-filter mb-4 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
      <TextField
        showOptional={false}
        label="Search"
        type="search"
        value={text}
        placeholder="Category name"
        onChange={(e) => {
          setText(e.target.value);
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => go({ q: value, group: grp, status }), 300);
        }}
      />
      <CascadeFilter
        label="Category"
        groups={categories}
        selected={grp}
        onChange={(ids) => {
          setGrp(ids);
          go({ q: text, group: ids, status });
        }}
      />
      <StatusFilter
        selected={status}
        groups={CATEGORY_STATUS_GROUPS}
        emptyLabel="All statuses"
        onChange={(v) => {
          setStatus(v);
          go({ q: text, group: grp, status: v });
        }}
      />
    </div>
  );
}
