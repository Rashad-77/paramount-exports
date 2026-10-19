"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ListSort({
  action,
  params,
  value,
  options,
}: {
  action: string;
  params: Record<string, string | undefined>;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <label className="flex min-w-40 flex-col gap-1 pb-1 text-xs text-text-muted">
      <span>Sort by</span>
      <select
        value={value}
        disabled={pending}
        onChange={(event) => {
          const query = new URLSearchParams();
          for (const [key, param] of Object.entries(params)) {
            if (param && key !== "page" && key !== "sort") query.set(key, param);
          }
          query.set("sort", event.currentTarget.value);
          const search = query.toString();
          start(() => router.replace(search ? `${action}?${search}` : action, { scroll: false }));
        }}
        className="min-h-9 border border-border-strong bg-surface px-2.5 text-sm text-text"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
