"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface GlassOption {
  value: string;
  label: string;
}

/**
 * A drop-down in the site's frosted-glass style (the browser's own list cannot be styled). It follows the standard listbox pattern:
 * the button opens the list; Up / Down / Home / End move through it, Enter or Space picks, Escape and Tab close it, and typing a letter
 * jumps to the next option that starts with it. The picked option and the one under the pointer or cursor are bold. The box is as
 * wide as the longest option and the list opens flush against it, so the two read as one piece of glass.
 */
export interface GlassSelectProps {
  label: string;
  options: GlassOption[];
  /** Controlled value; leave out to let the drop-down keep its own (then use `defaultValue`). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** With a name, the chosen value is posted with the surrounding form, like a native select. */
  name?: string;
  id?: string;
  disabled?: boolean;
  /** "bar" is the catalogue filter box; "field" matches the text boxes in forms. */
  variant?: "bar" | "field";
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function GlassSelect({ label, value, defaultValue, options, onChange, name, id: idProp, disabled, variant = "bar", invalid, describedBy, className }: GlassSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = Math.max(0, options.findIndex((o) => o.value === current));
  const [active, setActive] = useState(selected);

  // A form reset puts the box back to the value it started with, as a native select does.
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setInner(defaultValue ?? "");
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o) {
      setInner(o.value);
      onChange?.(o.value);
    }
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const last = options.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const any = from >= 0 ? from : options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (any >= 0) setActive(any);
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className={"gs" + (variant === "field" ? " gs-field" : "")} data-open={open || undefined}>
      {name ? <input ref={hidden} type="hidden" name={name} value={options[selected]?.value ?? ""} disabled={disabled} /> : null}
      <button
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        aria-label={variant === "bar" ? `${label}, ${options[selected]?.label ?? ""}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={(variant === "bar" ? "cat-control gs-button " : "gs-button ") + (className ?? "")}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="gs-label">{options[selected]?.label}</span>
        {/* Invisible copies of every option, bold, so the box is always as wide as the widest one and the list */}
        <span aria-hidden="true" className="gs-sizer">
          {options.map((o) => (
            <span key={o.value}>{o.label}</span>
          ))}
        </span>
      </button>
      {open ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="gs-panel">
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === selected}
              data-active={i === active || undefined}
              className="gs-opt"
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
