"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import type { GlassOption } from "@/components/public/glass-select";
import { cn } from "@/lib/cn";

/**
 * A single-choice drop-down in the same style as the Status filter: a plain box that opens a white panel, with group headings as small
 * capital labels and the choices under them. Posts its value with the form under `name`, like a native select.
 */
export function PanelSelect({
  label,
  options,
  value,
  defaultValue = "",
  onChange,
  name,
  placeholder,
  required,
  error,
  hint,
  quietPlaceholder = true,
  compact = false,
}: {
  label: string;
  options: GlassOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Show the placeholder greyed like an empty field. Turn off when it is a real choice, like "All". */
  quietPlaceholder?: boolean;
  /** A small box in a tight row (the unit box): small grey label, and a list as narrow as the box. */
  compact?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const current = value ?? inner;
  const chosen = options.find((o) => !o.heading && o.value === current);

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

  // The list is a popover in the browser's top layer: it is never clipped by a pop-up or a scrolling area, and it opens above the box
  // when there is not enough room below.
  useEffect(() => {
    const el = menu.current;
    const box = trigger.current;
    if (!el || !box) return;
    if (!open) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    const r = box.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    // It opens downward, and scrolls inside when the room is short. Only a box at the very bottom of the screen opens it upward.
    const up = below < 140 && above > below;
    const width = Math.max(r.width, compact ? 0 : 240);
    setPlace({
      left: Math.min(r.left, Math.max(8, window.innerWidth - width - 8)),
      width,
      ...(up
        ? { bottom: window.innerHeight - r.top + gap }
        : { top: r.bottom + gap }),
      maxHeight: Math.max(120, Math.min(320, up ? above : below)),
    });
    if (!el.matches(":popover-open")) el.showPopover();
    const close = (e: Event) => {
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, compact]);

  const pick = (v: string) => {
    setInner(v);
    onChange?.(v);
    setOpen(false);
  };

  return (
    <div
      ref={root}
      className={cn("relative flex flex-col", compact ? "gap-1" : "gap-1.5")}
    >
      <label
        htmlFor={`${id}-button`}
        className={
          compact
            ? "text-xs font-medium text-text-muted"
            : "text-sm font-medium tracking-[0.01em] text-text"
        }
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <div className="relative">
        <button
          ref={trigger}
          id={`${id}-button`}
          type="button"
          data-filter-trigger
          aria-haspopup="listbox"
          aria-expanded={open}
          data-invalid={error ? true : undefined}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 border border-border-strong bg-surface px-3 text-left text-[0.8125rem] data-[invalid=true]:border-2 data-[invalid=true]:border-danger",
            compact ? "h-9 py-0" : "min-h-11 py-2 md:min-h-10",
          )}
        >
          <span
            className={cn(
              "truncate",
              !chosen && quietPlaceholder && "text-text-muted/70",
            )}
          >
            {chosen ? (chosen.display ?? chosen.label) : placeholder}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        </button>
        <div
          ref={menu}
          popover="manual"
          role="listbox"
          aria-label={label}
          style={
            place
              ? {
                  left: place.left,
                  top: place.top,
                  bottom: place.bottom,
                  width: place.width,
                  maxHeight: place.maxHeight,
                }
              : undefined
          }
          className="fixed m-0 overflow-y-auto border border-border-strong bg-surface p-2 text-text shadow-lg [inset:auto] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {placeholder ? (
            <Option selected={current === ""} onPick={() => pick("")}>
              {placeholder}
            </Option>
          ) : null}
          {options.map((o) =>
            o.heading ? (
              <p
                key={o.value}
                className="px-1 pb-0.5 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted"
              >
                {o.label}
              </p>
            ) : (
              <Option
                key={o.value}
                selected={o.value === current}
                indent={o.indent}
                onPick={() => pick(o.value)}
              >
                {o.label}
              </Option>
            ),
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Option({
  selected,
  indent,
  onPick,
  children,
}: {
  selected: boolean;
  indent?: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        "flex min-h-9 w-full items-center justify-between gap-2 px-1 text-left text-[0.8125rem] hover:bg-black/5",
        indent && "pl-4",
        selected && "font-medium",
      )}
    >
      {children}
      {selected ? (
        <Check aria-hidden="true" className="size-4 shrink-0" />
      ) : null}
    </button>
  );
}

/** The form version: shows the form's error and gives back what was typed after a failed save. */
export function FPanelSelect({
  name,
  defaultValue,
  ...props
}: Omit<React.ComponentProps<typeof PanelSelect>, "error" | "value"> & {
  name: string;
}) {
  const { state } = useFormState();
  return (
    <PanelSelect
      name={name}
      defaultValue={state.values?.[name] ?? defaultValue}
      error={state.fieldErrors?.[name]?.[0]}
      {...props}
    />
  );
}
