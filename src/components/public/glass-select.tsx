"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface GlassOption {
  value: string;
  label: string;
  /** A group heading: shown in bold, never picked, and skipped by the keyboard. */
  heading?: boolean;
  /** A subcategory: indented under its heading. */
  indent?: boolean;
  /** What the closed box shows when this option is picked, when it should say more than the list does ("Furniture › Tables"). */
  display?: string;
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
  /** A long list: the open list is cropped to about seven rows and scrolls, with a scrollbar you can see. */
  scroll?: boolean;
}

export function GlassSelect({ label, value, defaultValue, options, onChange, name, id: idProp, disabled, variant = "bar", invalid, describedBy, className, scroll }: GlassSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const root = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const selected = Math.max(0, options.findIndex((o) => o.value === current));
  const [active, setActive] = useState(selected);

  // When the form's starting value changes (the page reloaded with what was just saved, or the form gave back what was typed after an
  // error), the box follows it, so a form that React resets after submitting never leaves the box on a stale value.
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (defaultValue !== seenDefault) {
    setSeenDefault(defaultValue);
    setInner(defaultValue ?? "");
  }
  // A form reset puts the box back to the value it started with, as a native select does. The starting value is read a moment later
  // so that a reset which comes with a new one (after a submit) lands on the new one.
  const latestDefault = useRef(defaultValue);
  useEffect(() => {
    latestDefault.current = defaultValue;
  });
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const reset = () => setTimeout(() => setInner(latestDefault.current ?? ""), 0);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // In a cropped, scrolling list the option the cursor is on (by keyboard, or the chosen one when the list opens) is kept in view.
  useEffect(() => {
    if (open && scroll) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, scroll, active, id]);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o?.heading) return;
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
    // Group headings cannot be picked, so the cursor steps over them.
    const step = (from: number, dir: 1 | -1) => {
      for (let i = from + dir; i >= 0 && i <= last; i += dir) if (!options[i]?.heading) return i;
      return from;
    };
    if (e.key === "ArrowDown") setActive((a) => step(a, 1));
    else if (e.key === "ArrowUp") setActive((a) => step(a, -1));
    else if (e.key === "Home") setActive(step(-1, 1));
    else if (e.key === "End") setActive(step(last + 1, -1));
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const from = options.findIndex((o, i) => i > active && !o.heading && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const any = from >= 0 ? from : options.findIndex((o) => !o.heading && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
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
        aria-label={variant === "bar" ? `${label}, ${options[selected]?.display ?? options[selected]?.label ?? ""}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={(variant === "bar" ? "cat-control gs-button " : "gs-button ") + (className ?? "")}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="gs-label">{options[selected]?.display ?? options[selected]?.label}</span>
        {/* Invisible copies of every option, bold, so the box is always as wide as the widest one and the list */}
        <span aria-hidden="true" className="gs-sizer">
          {options.map((o) => (
            <span key={o.value}>{o.display ?? o.label}</span>
          ))}
        </span>
      </button>
      {open ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className={"gs-panel" + (scroll ? " gs-scroll" : "")}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role={o.heading ? "presentation" : "option"}
              aria-selected={o.heading ? undefined : i === selected}
              data-active={!o.heading && i === active ? true : undefined}
              data-heading={o.heading || undefined}
              data-indent={o.indent || undefined}
              className="gs-opt"
              onPointerEnter={() => (o.heading ? undefined : setActive(i))}
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
