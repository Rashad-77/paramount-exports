"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface GlassOption {
  value: string;
  label: string;
}

/**
 * A drop-down in the site's frosted-glass style (the browser's own list cannot be styled). It follows the standard listbox pattern:
 * the button opens the list; Up / Down / Home / End move through it, Enter or Space picks, Escape and Tab close it, and typing a letter
 * jumps to the next option that starts with it. The picked option is marked with a tick, the one under the pointer or cursor is bold.
 */
export function GlassSelect({ label, value, options, onChange, className }: { label: string; value: string; options: GlassOption[]; onChange: (value: string) => void; className?: string }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);

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
    if (o) onChange(o.value);
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
    <div ref={root} className="gs">
      <button
        type="button"
        role="combobox"
        aria-label={`${label}, ${options[selected]?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={"cat-control gs-button " + (className ?? "")}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {options[selected]?.label}
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
              <span data-text={o.label}>{o.label}</span>
              {i === selected ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
