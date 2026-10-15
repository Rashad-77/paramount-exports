"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";

/**
 * The search box above a list. Typing (after a short pause) or pressing Search updates the address in place and only the list below
 * refreshes: the menu, the tabs and the box itself stay where they are, and the page does not jump or reload.
 * Without JavaScript it is an ordinary form that loads the page with the search.
 */
export function ListSearch({
  action,
  params,
  q,
  placeholder,
}: {
  action: string;
  params: Record<string, string | undefined>;
  q?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  const go = (text: string) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    if (text.trim()) u.set("q", text.trim());
    const qs = u.toString();
    start(() =>
      router.replace(qs ? `${action}?${qs}` : action, { scroll: false }),
    );
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(value), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      method="get"
      action={action}
      data-searching={pending ? "" : undefined}
      className="app-search mb-6 flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
    >
      {Object.entries(params).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <TextField
        showOptional={false}
        label="Search"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="min-w-64 flex-1"
      />
      <Button type="submit">Search</Button>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValue("");
            go("");
          }}
        >
          Clear
        </Button>
      ) : null}
    </form>
  );
}
