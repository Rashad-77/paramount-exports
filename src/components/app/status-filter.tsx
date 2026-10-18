"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export const STATUS_GROUPS: Array<{ label: string; items: Array<{ value: string; label: string }> }> = [
  {
    label: "Visibility",
    items: [
      { value: "published", label: "Published" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ],
  },
  {
    label: "Highlights",
    items: [
      { value: "featured", label: "Featured" },
      { value: "premium", label: "Premium" },
    ],
  },
  {
    label: "Availability",
    items: [
      { value: "in_stock", label: "In stock" },
      { value: "made_to_order", label: "Made to order" },
      { value: "sold", label: "Out of stock" },
    ],
  },
];

/**
 * A drop-down of every status with a tick box each, so several can be chosen at once. The ticked ones are posted with the filter form
 * as repeated `status` fields. Statuses of one group add up (published or draft); different groups narrow each other.
 */
export function StatusFilter({ selected, onChange }: { selected: string[]; onChange?: (values: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(() => new Set(selected));
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const labels = STATUS_GROUPS.flatMap((g) => g.items).filter((i) => picked.has(i.value)).map((i) => i.label);
  const summary = labels.length === 0 ? "Active (published and draft)" : labels.length <= 2 ? labels.join(", ") : `${labels.length} statuses`;

  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <label htmlFor={`${id}-button`} className="text-sm font-medium tracking-[0.01em] text-text">
        Status
      </label>
      <button
        id={`${id}-button`}
        type="button"
        data-filter-trigger
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="text-[0.8125rem] flex min-h-11 w-full items-center justify-between gap-2 border border-border-strong bg-surface px-3 py-2 text-left md:min-h-10"
      >
        <span id={`${id}-value`} className="truncate">
          {summary}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      <div hidden={!open} className="absolute left-0 top-full z-30 mt-1 w-full min-w-60 border border-border-strong bg-surface p-2 shadow-lg">
        {STATUS_GROUPS.map((g) => (
          <fieldset key={g.label} className="mb-1 last:mb-0">
            <legend className="px-1 pt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{g.label}</legend>
            {g.items.map((i) => (
              <label key={i.value} className="flex min-h-9 cursor-pointer items-center gap-2.5 px-1 text-[0.8125rem] hover:bg-black/5">
                <input
                  type="checkbox"
                  name="status"
                  value={i.value}
                  checked={picked.has(i.value)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(i.value);
                    else next.delete(i.value);
                    setPicked(next);
                    onChange?.([...next]);
                  }}
                  className="size-4 accent-[var(--color-walnut)]"
                />
                {i.label}
              </label>
            ))}
          </fieldset>
        ))}
        {picked.size > 0 ? (
          <button type="button" onClick={() => { setPicked(new Set()); onChange?.([]); }} className="mt-1 w-full border-t border-border px-1 pt-2 text-left text-sm underline">
            Clear statuses
          </button>
        ) : null}
      </div>
    </div>
  );
}
