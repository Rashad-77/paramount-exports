"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GlassSelect } from "@/components/public/glass-select";

/**
 * Search box and "Sort by" above an account list. Both live in the address (?q= and ?sort=), so a view can be bookmarked; typing waits a moment
 * before the list reloads, and only the list below changes.
 */
export function AccountSort({ value, options, basePath, q = "", placeholder = "Search" }: { value: string; options: Array<{ value: string; label: string }>; basePath: string; q?: string; placeholder?: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  const [, start] = useTransition();
  const first = useRef(true);

  const go = (nextSort: string, nextQ: string) => {
    const u = new URLSearchParams();
    if (nextSort !== options[0]?.value) u.set("sort", nextSort);
    if (nextQ.trim()) u.set("q", nextQ.trim());
    const qs = u.toString();
    start(() => router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go(value, text), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className="acct-sort">
      <div className="cat-searchwrap acct-search-wrap">
        <Search aria-hidden="true" className="cat-searchicon" strokeWidth={1.75} />
        <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={80} className="cat-control cat-search acct-search" />
      </div>
      <GlassSelect variant="bar" label="Sort by" value={value} options={options} onChange={(v) => go(v, text)} />
    </div>
  );
}
