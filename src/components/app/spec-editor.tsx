"use client";

import { Plus, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PanelSelect } from "@/components/app/panel-select";
import { SelectField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { DIM_UNITS, SPEC_CATALOG, SPEC_GROUPS, catalogItem, parseDimsText, type DimUnit, type SpecCatalogItem, type SpecEntry } from "@/lib/specifications";

type Row = SpecEntry & { id: string; legacyText?: string };

const input =
  "block w-full min-h-10 border border-border-strong bg-surface px-3 py-2 text-text placeholder:text-text-muted/70 focus-visible:outline-none aria-[invalid=true]:border-danger";

let counter = 0;
const nextId = () => `spec-${++counter}`;

/** The row as the server receives it. A dimensions row that was entered as free text and not yet filled in keeps its old text. */
const toEntry = (row: Row): SpecEntry => {
  const { id: _id, legacyText, ...entry } = row;
  void _id;
  if (entry.type === "dims" && legacyText && entry.dims && !entry.dims.w && !entry.dims.d && !entry.dims.h) return { ...entry, values: [legacyText] };
  return entry;
};

const fromEntry = (e: SpecEntry): Row => {
  if (e.type !== "dims" || e.dims) return { ...e, id: nextId() };
  const text = e.values[0] ?? "";
  const dims = text ? parseDimsText(text) : null;
  return dims ? { ...e, id: nextId(), dims } : { ...e, id: nextId(), dims: { w: "", d: "", h: "", unit: "cm" }, legacyText: text || undefined };
};

/**
 * The product's specifications as one uniform list of "type → value" rows. "Add specification" opens a searchable catalogue of types
 * (and a way to add your own); each row takes the kind of value that suits it: text, several values, or W / D / H with a unit.
 * The rows travel with the form as one `specifications` field. The product's type (ready-made or made to order) is the first row.
 */
export function SpecificationsEditor({
  initial,
  kind,
  kindError,
}: {
  initial: SpecEntry[];
  kind: string;
  kindError?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(fromEntry));
  const used = new Set(rows.map((r) => r.key));

  const add = (item: SpecCatalogItem | { custom: string }) => {
    setRows((cur) => {
      if ("custom" in item) {
        const label = item.custom.trim().slice(0, 60);
        if (!label) return cur;
        return [...cur, { id: nextId(), key: `custom-${Date.now().toString(36)}`, label, type: "text", values: [""] }];
      }
      return [
        ...cur,
        {
          id: nextId(),
          key: item.key,
          label: item.label,
          type: item.type,
          values: item.type === "list" ? [] : [""],
          ...(item.type === "dims" ? { dims: { w: "", d: "", h: "", unit: "cm" as DimUnit } } : {}),
        },
      ];
    });
  };
  const patch = (id: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => setRows((cur) => cur.filter((r) => r.id !== id));

  const json = JSON.stringify(rows.map(toEntry));

  return (
    <div className="space-y-3">
      <input type="hidden" name="specifications" value={json} />

      <div className="grid gap-2 border border-border bg-surface p-3 sm:grid-cols-[10rem_1fr] sm:items-center">
        <p className="text-sm font-medium">Type</p>
        <SelectField
          label="Type"
          name="kind"
          defaultValue={kind}
          error={kindError}
          className="[&>label]:sr-only"
          options={[
            { value: "stocked", label: "Ready-made (stocked)" },
            { value: "made_to_order", label: "Made to order" },
          ]}
        />
      </div>

      {rows.map((r) => (
        <div key={r.id} className="grid gap-2 border border-border bg-surface p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
          <p className="pt-2 text-sm font-medium">{r.label}</p>
          <div className="min-w-0">
            {r.type === "text" ? (
              <input
                aria-label={r.label}
                className={input}
                value={r.values[0] ?? ""}
                maxLength={200}
                placeholder={catalogItem(r.key)?.placeholder}
                onChange={(e) => patch(r.id, { values: [e.target.value] })}
              />
            ) : null}
            {r.type === "list" ? <ListValues row={r} onChange={(values) => patch(r.id, { values })} /> : null}
            {r.type === "dims" ? <DimsValues row={r} onChange={(dims) => patch(r.id, { dims })} /> : null}
          </div>
          <button
            type="button"
            onClick={() => remove(r.id)}
            aria-label={`Remove ${r.label}`}
            className="inline-flex size-10 items-center justify-center text-text-muted hover:bg-linen hover:text-danger"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}

      <AddSpecification used={used} onAdd={add} />
    </div>
  );
}

/** Several values for one type (materials, finishes…): each is a chip; type one and press Enter or comma to add it. */
function ListValues({ row, onChange }: { row: Row; onChange: (values: string[]) => void }) {
  const [text, setText] = useState("");
  const suggestions = catalogItem(row.key)?.suggestions ?? [];
  const commit = (raw: string) => {
    const parts = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (!parts.length) return;
    const fresh = parts.filter((p) => !row.values.some((v) => v.toLowerCase() === p.toLowerCase()));
    if (fresh.length) onChange([...row.values, ...fresh]);
    setText("");
  };
  return (
    <div>
      {row.values.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={`${row.label} values`}>
          {row.values.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 border border-border-strong bg-linen py-0.5 pl-2.5 pr-0.5 text-sm">
              {v}
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(row.values.filter((x) => x !== v))} className="inline-flex size-6 items-center justify-center hover:text-danger">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        aria-label={`Add ${row.label.toLowerCase()}`}
        className={input}
        value={text}
        placeholder={row.values.length ? "Add another, then press Enter" : (catalogItem(row.key)?.placeholder ?? "Type a value, then press Enter")}
        onChange={(e) => {
          const v = e.target.value;
          // Typing a comma adds the value at once.
          if (v.endsWith(",")) commit(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          } else if (e.key === "Backspace" && !text && row.values.length) onChange(row.values.slice(0, -1));
        }}
        onBlur={() => commit(text)}
      />
      {suggestions.filter((sg) => !row.values.some((v) => v.toLowerCase() === sg.toLowerCase()) && (!text.trim() || sg.toLowerCase().includes(text.trim().toLowerCase()))).length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1" aria-label={`Suggested ${row.label.toLowerCase()}`}>
          {suggestions
            .filter((sg) => !row.values.some((v) => v.toLowerCase() === sg.toLowerCase()) && (!text.trim() || sg.toLowerCase().includes(text.trim().toLowerCase())))
            .slice(0, 8)
            .map((sg) => (
              <li key={sg}>
                <button type="button" onClick={() => commit(sg)} className="border border-dashed border-border-strong px-2 py-0.5 text-xs text-text-muted hover:bg-black/5">
                  + {sg}
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Width, depth and height as separate boxes, with the unit chosen once for all three. */
function DimsValues({ row, onChange }: { row: Row; onChange: (d: NonNullable<Row["dims"]>) => void }) {
  const d = row.dims ?? { w: "", d: "", h: "", unit: "cm" as DimUnit };
  const set = (p: Partial<typeof d>) => onChange({ ...d, ...p });
  const box = (k: "w" | "d" | "h", label: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-text-muted">
      {label}
      <input inputMode="decimal" className={cn(input, "tabular")} value={d[k]} maxLength={10} placeholder="0" onChange={(e) => set({ [k]: e.target.value.replace(/[^\d.]/g, "") })} />
    </label>
  );
  return (
    <div>
      <div className="grid grid-cols-[1fr_1fr_1fr_5.5rem] gap-2">
        {box("w", "Width (W)")}
        {box("d", "Depth (D)")}
        {box("h", "Height (H)")}
        <PanelSelect compact label="Unit" value={d.unit} options={DIM_UNITS.map((u) => ({ value: u, label: u }))} onChange={(v) => set({ unit: v as DimUnit })} />
      </div>
      {row.legacyText ? <p className="mt-1.5 text-sm text-text-muted">Entered earlier as “{row.legacyText}”. It stays as it is until you fill in the boxes above.</p> : null}
    </div>
  );
}

/** The "Add specification" control: a button that opens a searchable list of every type, plus a way to add a type of your own. */
function AddSpecification({ used, onAdd }: { used: Set<string>; onAdd: (item: SpecCatalogItem | { custom: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const q = query.trim().toLowerCase();
  // Flat list of choices in display order: catalogue types that match, then "add your own".
  const matches = useMemo(() => SPEC_CATALOG.filter((c) => !used.has(c.key) && (!q || c.label.toLowerCase().includes(q))), [used, q]);
  const exact = SPEC_CATALOG.some((c) => c.label.toLowerCase() === q);
  const choices: Array<{ kind: "type"; item: SpecCatalogItem } | { kind: "custom"; label: string }> = [
    ...matches.map((item) => ({ kind: "type" as const, item })),
    ...(q && !exact ? [{ kind: "custom" as const, label: query.trim() }] : []),
  ];

  const pick = (i: number) => {
    const c = choices[i];
    if (!c) return;
    onAdd(c.kind === "type" ? c.item : { custom: c.label });
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          setActive(0);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-h-10 items-center gap-2 border border-walnut px-4 text-sm font-medium text-walnut hover:bg-walnut hover:text-ivory"
      >
        <Plus aria-hidden="true" className="size-4" />
        Add specification
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-[min(24rem,calc(100vw-2rem))] border border-border-strong bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            <input
              ref={search}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={choices.length ? `${listId}-${active}` : undefined}
              data-dropdown-search
              aria-label="Search specification types"
              className="min-h-11 w-full bg-transparent py-2 text-[0.8125rem] outline-none placeholder:text-text-muted/70"
              placeholder="Search types, or type your own"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(choices.length - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  pick(active);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Specification types" className="max-h-72 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {choices.length === 0 ? <li className="px-3 py-3 text-sm text-text-muted">{q ? "Nothing matches." : "Every type is already added. Type a name to add your own."}</li> : null}
            {choices.map((c, i) => {
              const prev = choices[i - 1];
              const group = c.kind === "type" ? c.item.group : "Your own type";
              const prevGroup = prev ? (prev.kind === "type" ? prev.item.group : "Your own type") : null;
              return (
                <li key={c.kind === "type" ? c.item.key : "custom"} role="presentation">
                  {group !== prevGroup ? <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{group}</p> : null}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => pick(i)}
                    className={cn("cursor-pointer px-3 py-2 text-[0.8125rem]", i === active && "bg-black/5 font-medium")}
                  >
                    {c.kind === "type" ? c.item.label : `Add “${c.label}” as your own type`}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {!open ? <p className="mt-1.5 text-sm text-text-muted">Pick from {SPEC_GROUPS.length} groups of types, or add your own. Types you do not add are not shown on the product page.</p> : null}
    </div>
  );
}
