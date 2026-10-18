"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { TextField } from "@/components/ui/field";
import { cn } from "@/lib/cn";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(v: string | undefined): { y: number; m: number; d: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  return hit ? { y: Number(hit[1]), m: Number(hit[2]) - 1, d: Number(hit[3]) } : null;
}

const show = (v: string) => {
  const p = parse(v);
  return p ? `${p.d} ${MONTHS[p.m]!.slice(0, 3)} ${p.y}` : "";
};

/**
 * A date box with our own calendar, in place of the browser's built-in date picker. It posts the date as YYYY-MM-DD under `name`,
 * exactly as a date input does. Same props as the text boxes it replaces (label, hint, error, required, min, max).
 */
export function DateField({
  name,
  defaultValue,
  min,
  max,
  ...field
}: { name: string; defaultValue?: string; min?: string; max?: string } & Omit<ComponentProps<typeof TextField>, "name" | "type" | "value" | "defaultValue" | "min" | "max" | "onChange">) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [seen, setSeen] = useState(defaultValue ?? "");
  const today = new Date();
  const start = parse(value) ?? { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [open, setOpen] = useState(false);

  // A form that comes back with new starting values (after a save, or an error) gives the box that value.
  if ((defaultValue ?? "") !== seen) {
    setSeen(defaultValue ?? "");
    setValue(defaultValue ?? "");
  }

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

  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array.from({ length: first }, () => null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const step = (by: number) => {
    const d = new Date(view.y, view.m + by, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const blocked = (d: number) => {
    const v = iso(view.y, view.m, d);
    return Boolean((min && v < min) || (max && v > max));
  };
  const pick = (d: number) => {
    setValue(iso(view.y, view.m, d));
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <input type="hidden" name={name} value={value} />
      <TextField
        {...field}
        id={`${id}-input`}
        type="text"
        readOnly
        value={show(value)}
        placeholder="Choose a date"
        autoComplete="off"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        inputClassName="cursor-pointer"
      />
      {open ? (
        <div role="dialog" aria-label="Choose a date" className="absolute left-0 top-full z-40 mt-1 w-[17rem] border border-border-strong bg-surface p-3 text-sm shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => step(-1)} className="inline-flex size-8 items-center justify-center hover:bg-black/5">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <p className="font-medium" aria-live="polite">
              {MONTHS[view.m]} {view.y}
            </p>
            <button type="button" aria-label="Next month" onClick={() => step(1)} className="inline-flex size-8 items-center justify-center hover:bg-black/5">
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text-muted">
            {DAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 text-center">
            {cells.map((d, i) =>
              d === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  disabled={blocked(d)}
                  aria-pressed={value === iso(view.y, view.m, d)}
                  onClick={() => pick(d)}
                  className={cn(
                    "tabular m-0.5 inline-flex h-8 items-center justify-center text-[0.8125rem] hover:bg-black/5 disabled:cursor-not-allowed disabled:text-text-muted/40 disabled:hover:bg-transparent",
                    value === iso(view.y, view.m, d) && "bg-walnut-dark font-medium text-ivory hover:bg-walnut-dark",
                    iso(view.y, view.m, d) === iso(today.getFullYear(), today.getMonth(), today.getDate()) && value !== iso(view.y, view.m, d) && "border border-border-strong",
                  )}
                >
                  {d}
                </button>
              ),
            )}
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
              className="px-1 text-[0.8125rem] underline"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setView({ y: today.getFullYear(), m: today.getMonth() });
              }}
              className="px-1 text-[0.8125rem] underline"
            >
              This month
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
