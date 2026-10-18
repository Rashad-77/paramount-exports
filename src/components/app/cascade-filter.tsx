"use client";

import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import { cn } from "@/lib/cn";

export interface CascadeGroup {
  id: string;
  name: string;
  children: Array<{ id: string; name: string }>;
}

const trigger = "text-[0.8125rem] flex min-h-11 w-full items-center justify-between gap-2 border border-border-strong bg-surface px-3 py-2 text-left md:min-h-10";
const panel = "border border-border-strong bg-surface p-2 shadow-lg";
const row = "hover:bg-black/5";

/**
 * Category drop-down for two levels. The panel lists the groups; pointing at a group (or tapping its arrow) opens its categories in a
 * second panel beside it. Same look as the other drop-downs in the staff area.
 * With `multiple` (the list filter) groups and categories have tick boxes and any number can be picked; a ticked group stands for everything
 * under it. Without it (the product form) one category is chosen: a group with categories under it only opens its list.
 */
export function CascadeFilter({
  label,
  allLabel = "All",
  groups,
  selected,
  onChange,
  multiple = true,
  name,
  required,
  error,
  hint,
}: {
  label: string;
  /** What the box says when nothing is chosen: "All" for the filter, the prompt for the form. */
  allLabel?: string;
  groups: CascadeGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  /** Posts the chosen id with the form (single choice only). */
  name?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  /** Opens the second panel on the left when there is no room for it on the right of the screen. */
  const [flip, setFlip] = useState(false);
  const picked = new Set(selected);

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

  const names = new Map<string, string>();
  for (const g of groups) {
    names.set(g.id, g.name);
    for (const c of g.children) names.set(c.id, c.name);
  }
  const parentOf = new Map<string, string>();
  for (const g of groups) for (const c of g.children) parentOf.set(c.id, g.name);
  const labels = selected.map((s) => names.get(s)).filter((n): n is string => Boolean(n));
  const summary = multiple
    ? labels.length === 0
      ? allLabel
      : labels.length <= 2
        ? labels.join(", ")
        : `${labels.length} categories`
    : selected[0]
      ? parentOf.has(selected[0])
        ? `${parentOf.get(selected[0])} › ${names.get(selected[0])}`
        : (names.get(selected[0]) ?? allLabel)
      : allLabel;

  const choose = (cid: string) => {
    onChange([cid]);
    setOpen(false);
  };
  const toggleGroup = (g: CascadeGroup) => {
    const kids = new Set(g.children.map((c) => c.id));
    const rest = selected.filter((s) => s !== g.id && !kids.has(s));
    const on = picked.has(g.id) || (g.children.length > 0 && g.children.every((c) => picked.has(c.id)));
    onChange(on ? rest : [...rest, g.id]);
  };
  const toggleChild = (g: CascadeGroup, childId: string) => {
    // A ticked group becomes its categories, so one of them can be taken out.
    const base = picked.has(g.id) ? [...selected.filter((s) => s !== g.id), ...g.children.map((c) => c.id)] : selected;
    onChange(base.includes(childId) ? base.filter((s) => s !== childId) : [...base, childId]);
  };

  const active = groups.find((g) => g.id === shown);

  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <label htmlFor={`${id}-button`} className="text-sm font-medium tracking-[0.01em] text-text">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {name ? <input type="hidden" name={name} value={selected[0] ?? ""} /> : null}
      <button
        id={`${id}-button`}
        type="button"
        data-filter-trigger
        data-invalid={error ? true : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setFlip((root.current?.getBoundingClientRect().right ?? 0) + 256 > window.innerWidth);
          setOpen((o) => !o);
        }}
        className={cn(trigger, "data-[invalid=true]:border-2 data-[invalid=true]:border-danger")}
      >
        <span className={cn("truncate", !multiple && !selected[0] && "text-text-muted/70")}>{summary}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </button>
      <div hidden={!open} className={cn("absolute left-0 top-full z-30 mt-1 w-full min-w-60", panel)}>
        {multiple ? (
          <button
            type="button"
            onClick={() => onChange([])}
            onPointerEnter={() => setShown(null)}
            className={cn("flex min-h-9 w-full items-center justify-between px-1 text-left text-[0.8125rem]", row, selected.length === 0 && "font-medium")}
          >
            {allLabel}
            {selected.length === 0 ? <Check aria-hidden="true" className="size-4" /> : null}
          </button>
        ) : null}
        <ul>
          {groups.map((g) => {
            const hasKids = g.children.length > 0;
            const kidsOn = g.children.filter((c) => picked.has(c.id)).length;
            const all = picked.has(g.id) || (hasKids && kidsOn === g.children.length);
            const some = !all && kidsOn > 0;
            return (
              <li key={g.id} onPointerEnter={() => setShown(g.id)}>
                <div className={cn("flex min-h-9 items-center gap-2 px-1", row, shown === g.id && "bg-black/5")}>
                  {multiple ? (
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[0.8125rem]">
                      <input
                        type="checkbox"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = some;
                        }}
                        onChange={() => toggleGroup(g)}
                        className="size-4 accent-[var(--color-walnut)]"
                      />
                      <span className="truncate">{g.name}</span>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => (hasKids ? setShown(shown === g.id ? null : g.id) : choose(g.id))}
                      className={cn("flex min-w-0 flex-1 items-center justify-between text-left text-[0.8125rem]", picked.has(g.id) && "font-medium")}
                    >
                      <span className="truncate">{g.name}</span>
                      {picked.has(g.id) ? <Check aria-hidden="true" className="size-4" /> : null}
                    </button>
                  )}
                  {hasKids ? (
                    <button
                      type="button"
                      aria-label={`Show categories in ${g.name}`}
                      aria-expanded={shown === g.id}
                      onClick={() => setShown(shown === g.id ? null : g.id)}
                      className="inline-flex size-7 items-center justify-center"
                    >
                      <ChevronRight aria-hidden="true" className={cn("size-4 transition-transform", shown === g.id && "rotate-90 md:rotate-0")} />
                    </button>
                  ) : null}
                </div>
                {shown === g.id && hasKids ? (
                  <ul className="mb-1 ml-5 border-l border-border md:hidden">
                    {g.children.map((c) =>
                      multiple ? (
                        <ChildRow key={c.id} checked={picked.has(g.id) || picked.has(c.id)} onToggle={() => toggleChild(g, c.id)} name={c.name} />
                      ) : (
                        <ChoiceRow key={c.id} selected={picked.has(c.id)} onPick={() => choose(c.id)} name={c.name} />
                      ),
                    )}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
        {active && active.children.length > 0 ? (
          <div className={cn("absolute top-0 z-30 hidden w-60", flip ? "right-full mr-1" : "left-full ml-1", " md:block", panel)}>
            <ul>
              {active.children.map((c) =>
                multiple ? (
                  <ChildRow key={c.id} checked={picked.has(active.id) || picked.has(c.id)} onToggle={() => toggleChild(active, c.id)} name={c.name} />
                ) : (
                  <ChoiceRow key={c.id} selected={picked.has(c.id)} onPick={() => choose(c.id)} name={c.name} />
                ),
              )}
            </ul>
          </div>
        ) : null}
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

function ChildRow({ checked, onToggle, name }: { checked: boolean; onToggle: () => void; name: string }) {
  return (
    <li>
      <label className={cn("flex min-h-9 cursor-pointer items-center gap-2.5 px-1 text-[0.8125rem]", row)}>
        <input type="checkbox" checked={checked} onChange={onToggle} className="size-4 accent-[var(--color-walnut)]" />
        {name}
      </label>
    </li>
  );
}

function ChoiceRow({ selected, onPick, name }: { selected: boolean; onPick: () => void; name: string }) {
  return (
    <li>
      <button type="button" onClick={onPick} className={cn("flex min-h-9 w-full items-center justify-between px-2 text-left text-[0.8125rem]", row, selected && "font-medium")}>
        {name}
        {selected ? <Check aria-hidden="true" className="size-4" /> : null}
      </button>
    </li>
  );
}

/** The form version: one category, with the form's error, and what was typed given back after a failed save. */
export function FCategorySelect({ name, defaultValue, ...props }: Omit<React.ComponentProps<typeof CascadeFilter>, "selected" | "onChange" | "multiple" | "error"> & { name: string; defaultValue?: string }) {
  const { state } = useFormState();
  const start = state.values?.[name] ?? defaultValue ?? "";
  const [value, setValue] = useState(start);
  const [seen, setSeen] = useState(start);
  if (start !== seen) {
    setSeen(start);
    setValue(start);
  }
  return <CascadeFilter {...props} name={name} multiple={false} selected={value ? [value] : []} onChange={(ids) => setValue(ids[0] ?? "")} error={state.fieldErrors?.[name]?.[0]} />;
}
