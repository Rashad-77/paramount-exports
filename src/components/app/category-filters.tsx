"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { PanelSelect } from "@/components/app/panel-select";
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
  group,
  statuses,
  groups,
}: {
  q?: string;
  group?: string;
  statuses: string[];
  groups: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");
  const [grp, setGrp] = useState(group ?? "");
  const [status, setStatus] = useState(statuses);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // When the address changes from outside (Clear filters), the boxes follow it.
  const key = JSON.stringify([q ?? "", group ?? "", statuses]);
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setText(q ?? "");
    setGrp(group ?? "");
    setStatus(statuses);
  }

  const go = (next: { q: string; group: string; status: string[] }) => {
    const u = new URLSearchParams();
    if (next.q.trim()) u.set("q", next.q.trim());
    if (next.group) u.set("group", next.group);
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
      <PanelSelect
        label="Group"
        placeholder="All groups"
        quietPlaceholder={false}
        value={grp}
        options={groups.map((g) => ({ value: g.id, label: g.name }))}
        onChange={(v) => {
          setGrp(v);
          go({ q: text, group: v, status });
        }}
      />
      <StatusFilter
        selected={status}
        groups={CATEGORY_STATUS_GROUPS}
        emptyLabel="Active (visible and hidden)"
        onChange={(v) => {
          setStatus(v);
          go({ q: text, group: grp, status: v });
        }}
      />
    </div>
  );
}
