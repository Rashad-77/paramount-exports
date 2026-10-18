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

  const pick = (v: string) => {
    setInner(v);
    onChange?.(v);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <label htmlFor={`${id}-button`} className={compact ? "text-xs font-medium text-text-muted" : "text-sm font-medium tracking-[0.01em] text-text"}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        id={`${id}-button`}
        type="button"
        data-filter-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={error ? true : undefined}
        onClick={() => setOpen((o) => !o)}
        className="text-[0.8125rem] flex min-h-11 w-full items-center justify-between gap-2 border border-border-strong bg-surface px-3 py-2 text-left data-[invalid=true]:border-2 data-[invalid=true]:border-danger md:min-h-10"
      >
        <span className={cn("truncate", !chosen && quietPlaceholder && "text-text-muted/70")}>{chosen ? (chosen.display ?? chosen.label) : placeholder}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      <div
        hidden={!open}
        role="listbox"
        aria-label={label}
        className={cn("absolute left-0 top-full z-30 mt-1 max-h-80 w-full overflow-y-auto border border-border-strong bg-surface p-2 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", !compact && "min-w-60")}
      >
        {placeholder ? (
          <Option selected={current === ""} onPick={() => pick("")}>
            {placeholder}
          </Option>
        ) : null}
        {options.map((o) =>
          o.heading ? (
            <p key={o.value} className="px-1 pb-0.5 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
              {o.label}
            </p>
          ) : (
            <Option key={o.value} selected={o.value === current} indent={o.indent} onPick={() => pick(o.value)}>
              {o.label}
            </Option>
          ),
        )}
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

function Option({ selected, indent, onPick, children }: { selected: boolean; indent?: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn("flex min-h-9 w-full items-center justify-between gap-2 px-1 text-left text-[0.8125rem] hover:bg-black/5", indent && "pl-4", selected && "font-medium")}
    >
      {children}
      {selected ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
    </button>
  );
}

/** The form version: shows the form's error and gives back what was typed after a failed save. */
export function FPanelSelect({ name, defaultValue, ...props }: Omit<React.ComponentProps<typeof PanelSelect>, "error" | "value"> & { name: string }) {
  const { state } = useFormState();
  return <PanelSelect name={name} defaultValue={state.values?.[name] ?? defaultValue} error={state.fieldErrors?.[name]?.[0]} {...props} />;
}
