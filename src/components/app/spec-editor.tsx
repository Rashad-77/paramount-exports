"use client";

import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createSpecTypeAction, deleteSpecTypeAction, deleteSpecValueAction, renameSpecTypeAction, renameSpecValueAction, saveSpecValueAction } from "@/app/app/products/spec-actions";
import { PanelSelect } from "@/components/app/panel-select";
import { Button } from "@/components/ui/button";
import { useFormState } from "@/components/forms/action-form";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { DIM_UNITS, SPEC_CATALOG, SPEC_GROUPS, isBuiltinSuggestion, parseDimsText, specKeyFor, type DimUnit, type SavedSpecType, type SpecCatalogItem, type SpecEntry } from "@/lib/specifications";

type Row = SpecEntry & { id: string; legacyText?: string };

const input =
  "block w-full min-h-10 border border-border-strong bg-surface px-3 py-2 text-text placeholder:text-text-muted/70 focus-visible:outline-none aria-[invalid=true]:border-danger";

/** "Material" becomes "materials", "Finish" becomes "finishes". */
const plural = (label: string) => {
  const w = label.trim().toLowerCase();
  if (/(s|sh|ch|x|z)$/.test(w)) return w.endsWith("s") ? w : `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
};

/** Alphabetical, ignoring capital letters. */
const alpha = (list: string[]) => [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

/** The same list with each value once (ignoring capital letters), in the order first seen. */
const uniqueValues = (list: string[]) => list.filter((v, i) => list.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);

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
  savedTypes = [],
  savedValues = {},
  savedHidden = {},
}: {
  initial: SpecEntry[];
  kind: string;
  kindError?: string;
  /** Types the staff created earlier, and the extra values (material names…) they have added. Both are kept for every product. */
  savedTypes?: SavedSpecType[];
  savedValues?: Record<string, string[]>;
  /** Built-in suggestions the staff have removed. */
  savedHidden?: Record<string, string[]>;
}) {
  // Material is on every product, always the first row, and cannot be removed.
  const [rows, setRows] = useState<Row[]>(() => {
    const made = initial.map(fromEntry);
    return made.some((r) => r.key === "material") ? made : [{ id: nextId(), key: "material", label: "Material", type: "list", values: [] }, ...made];
  });
  const { state: formState } = useFormState();
  const materialError = formState.fieldErrors?.specifications?.[0];
  const [types, setTypes] = useState<SavedSpecType[]>(savedTypes);
  const [values, setValues] = useState<Record<string, string[]>>(savedValues);
  const [hidden, setHidden] = useState<Record<string, string[]>>(savedHidden);
  const used = new Set(rows.map((r) => r.key));
  /** The row whose Edit window is open. */
  const [editingRow, setEditingRow] = useState<string | null>(null);

  // The built-in catalogue, then the staff's own types, each with the values staff have added for it.
  const catalog: SpecCatalogItem[] = useMemo(
    () => [
      ...SPEC_CATALOG.map((c) => (c.type === "list" ? { ...c, suggestions: uniqueValues([...(values[c.key] ?? []), ...(c.suggestions ?? []).filter((sg) => !(hidden[c.key] ?? []).some((h) => h.toLowerCase() === sg.toLowerCase()))]) } : c)),
      ...types
        .filter((t) => !SPEC_CATALOG.some((c) => c.key === t.key))
        .map((t) => ({ key: t.key, label: t.label, type: t.type, group: "Your own types", suggestions: uniqueValues(values[t.key] ?? []) }) as SpecCatalogItem),
    ],
    [types, values, hidden],
  );
  const itemFor = (key: string) => catalog.find((c) => c.key === key);

  const add = (item: SpecCatalogItem) => {
    setRows((cur) => [
      ...cur,
      {
        id: nextId(),
        key: item.key,
        label: item.label,
        type: item.type,
        values: item.type === "list" ? [] : [""],
        ...(item.type === "dims" ? { dims: { w: "", d: "", h: "", unit: "cm" as DimUnit } } : {}),
      },
    ]);
  };

  /** Creates a type of the staff's own and saves it straight away, so it is in the list for every later product. */
  const createType = async (label: string, valueType: "text" | "list") => {
    const clean = label.trim().slice(0, 60);
    if (!clean) return;
    const existing = catalog.find((c) => c.label.toLowerCase() === clean.toLowerCase());
    if (existing) {
      if (!used.has(existing.key)) add(existing);
      return;
    }
    const fd = new FormData();
    fd.set("label", clean);
    fd.set("type", valueType);
    const saved = await createSpecTypeAction({}, fd).catch(() => null);
    // If saving fails the row is still added, and the type is saved again with the product.
    const type: SavedSpecType = (saved?.ok ? (saved.data as SavedSpecType) : null) ?? { key: specKeyFor(clean), label: clean, type: valueType };
    setTypes((cur) => (cur.some((t) => t.key === type.key) ? cur : [...cur, type]));
    add({ key: type.key, label: type.label, type: type.type, group: "Your own types" });
  };

  const send = (action: (p: object, fd: FormData) => Promise<unknown>, fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    void action({}, fd).catch(() => undefined);
  };

  const lower = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  /** Renames a value in the suggestions (built in or saved): a built-in one is hidden and the new name saved. */
  const renameValue = (key: string, from: string, to: string) => {
    const clean = to.trim();
    if (!clean || lower(clean, from)) return;
    if (isBuiltinSuggestion(key, from)) setHidden((cur) => ({ ...cur, [key]: [...(cur[key] ?? []), from] }));
    setValues((cur) => {
      const rest = (cur[key] ?? []).filter((v) => !lower(v, from));
      return { ...cur, [key]: isBuiltinSuggestion(key, clean) || rest.some((v) => lower(v, clean)) ? rest : [clean, ...rest] };
    });
    send(renameSpecValueAction, { key, from, to: clean });
  };
  const deleteValue = (key: string, value: string) => {
    if (isBuiltinSuggestion(key, value)) setHidden((cur) => ({ ...cur, [key]: [...(cur[key] ?? []), value] }));
    setValues((cur) => ({ ...cur, [key]: (cur[key] ?? []).filter((v) => !lower(v, value)) }));
    send(deleteSpecValueAction, { key, value });
  };
  const renameType = (key: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    setTypes((cur) => cur.map((t) => (t.key === key ? { ...t, label: clean } : t)));
    send(renameSpecTypeAction, { key, label: clean });
  };
  const deleteType = (key: string) => {
    setTypes((cur) => cur.filter((t) => t.key !== key));
    send(deleteSpecTypeAction, { key });
  };

  /** A value typed for a several-value row (a new material name…): remembered for the next product. */
  const rememberValue = (key: string, value: string) => {
    const clean = value.trim();
    if (clean && isBuiltinSuggestion(key, clean) && (hidden[key] ?? []).some((h) => lower(h, clean))) {
      setHidden((cur) => ({ ...cur, [key]: (cur[key] ?? []).filter((h) => !lower(h, clean)) }));
      const back = new FormData();
      back.set("key", key);
      back.set("value", clean);
      void saveSpecValueAction({}, back).catch(() => undefined);
      return;
    }
    if (!clean || isBuiltinSuggestion(key, clean) || (values[key] ?? []).some((v) => lower(v, clean))) return;
    setValues((cur) => ((cur[key] ?? []).some((v) => lower(v, clean)) ? cur : { ...cur, [key]: [...(cur[key] ?? []), clean] }));
    const fd = new FormData();
    fd.set("key", key);
    fd.set("value", clean);
    void saveSpecValueAction({}, fd).catch(() => undefined);
  };
  const patch = (id: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => setRows((cur) => cur.filter((r) => r.id !== id));
  // A specification is only taken off the product after the owner confirms.
  const [removing, setRemoving] = useState<string | null>(null);
  const removingRow = rows.find((r) => r.id === removing);

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
        <div key={r.id} className="grid gap-2 border border-border bg-surface p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
          <p className="text-sm font-medium">
            {r.label}
            {r.key === "material" ? <span className="text-danger" aria-hidden="true"> *</span> : null}
          </p>
          <div className="min-w-0">
            {r.type === "text" ? (
              <input
                aria-label={r.label}
                className={input}
                value={r.values[0] ?? ""}
                maxLength={200}
                placeholder={itemFor(r.key)?.placeholder}
                onChange={(e) => patch(r.id, { values: [e.target.value] })}
              />
            ) : null}
            {r.type === "list" ? <ListValues row={r} item={itemFor(r.key)} editOpen={editingRow === r.id} onEditClose={() => setEditingRow(null)} onRemember={(v) => rememberValue(r.key, v)} onRename={(from, to) => renameValue(r.key, from, to)} onDelete={(v) => deleteValue(r.key, v)} onChange={(vals) => patch(r.id, { values: vals })} /> : null}
            {r.type === "dims" ? <DimsValues row={r} onChange={(dims) => patch(r.id, { dims })} /> : null}
          </div>
          <div className="flex items-start gap-0.5 sm:self-start">
            {r.type === "list" ? (
              <button type="button" onClick={() => setEditingRow(r.id)} aria-label={`Edit ${r.label.toLowerCase()}`} className="inline-flex size-6 items-center justify-center text-text-muted hover:bg-black/5 hover:text-text">
                <Pencil aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
            {r.key === "material" ? null : (
              <button type="button" onClick={() => setRemoving(r.id)} aria-label={`Remove ${r.label}`} className="inline-flex size-6 items-center justify-center text-text-muted hover:bg-black/5 hover:text-danger">
                <Trash2 aria-hidden="true" className="size-3.5" />
              </button>
            )}
          </div>
          {r.key === "material" && materialError ? (
            <p role="alert" className="text-[0.8125rem] text-danger sm:col-span-full">
              {materialError}
            </p>
          ) : null}
        </div>
      ))}

      <ConfirmDialog
        open={Boolean(removingRow)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removingRow?.label ?? "this specification"}?`}
        description="It is taken off this product when you save. You can add it again later."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removing) remove(removing);
          setRemoving(null);
        }}
      />

      <AddSpecification catalog={catalog} used={used} onAdd={add} onCreate={createType} onRename={renameType} onDelete={deleteType} />
    </div>
  );
}

/** Several values for one type (materials, finishes…): each is a chip; type one and press Enter or comma to add it. "Edit" opens a window to change or remove them all. */
function ListValues({
  row,
  item,
  editOpen,
  onEditClose,
  onRemember,
  onRename,
  onDelete,
  onChange,
}: {
  row: Row;
  item?: SpecCatalogItem;
  editOpen: boolean;
  onEditClose: () => void;
  onRemember: (value: string) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (value: string) => void;
  onChange: (values: string[]) => void;
}) {
  const [text, setText] = useState("");
  const suggestions = item?.suggestions ?? [];
  const commit = (raw: string) => {
    const parts = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (!parts.length) return;
    const fresh = parts.filter((p) => !row.values.some((v) => v.toLowerCase() === p.toLowerCase()));
    if (fresh.length) {
      onChange([...row.values, ...fresh]);
      for (const f of fresh) onRemember(f);
    }
    setText("");
  };
  const typed = text.trim().toLowerCase();
  const isOn = (sg: string) => row.values.some((v) => v.toLowerCase() === sg.toLowerCase());
  // Every suggestion is listed, as soon as it is added; the ones already on this product show ticked, and pressing one again takes it off.
  const offered = alpha(suggestions.filter((sg) => !typed || sg.toLowerCase().startsWith(typed)));
  return (
    <div>
      {row.values.length > 0 ? (
        <div className="mb-2">
          <ul className="flex flex-wrap gap-1.5" aria-label={`${row.label} values`}>
            {row.values.map((v) => (
              <li key={v} className="inline-flex items-center gap-1 border border-border-strong bg-linen py-0.5 pl-2.5 pr-0.5 text-sm">
                {v}
                <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(row.values.filter((x) => x !== v))} className="inline-flex size-6 items-center justify-center hover:text-danger">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <input
        aria-label={`Add ${row.label.toLowerCase()}`}
        className={input}
        value={text}
        placeholder={row.values.length ? "Add another, then press Enter" : (item?.placeholder ?? "Type a value, then press Enter")}
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
      {offered.length > 0 ? (
        // Two rows of suggestions are shown; typing narrows them, and Edit lists every value.
        <ul className="mt-1.5 flex max-h-[54px] flex-wrap gap-1 overflow-hidden" aria-label={`Suggested ${row.label.toLowerCase()}`}>
          {offered.map((sg) => (
            <li key={sg}>
              {isOn(sg) ? (
                <button type="button" aria-pressed="true" onClick={() => onChange(row.values.filter((v) => v.toLowerCase() !== sg.toLowerCase()))} className="border border-solid border-border-strong bg-linen px-2 py-0.5 text-xs text-text hover:bg-black/5">
                  ✓ {sg}
                </button>
              ) : (
                <button type="button" aria-pressed="false" onClick={() => commit(sg)} className="border border-dashed border-border-strong px-2 py-0.5 text-xs text-text-muted hover:bg-black/5">
                  + {sg}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <ValuesDialog open={editOpen} onClose={onEditClose} title={`Edit ${plural(row.label)}`} selected={row.values} suggestions={suggestions} onRename={onRename} onDelete={onDelete} onChange={onChange} />
    </div>
  );
}

/** The edit window for one specification's values. It only exists while open, so it always starts from what is current. */
function ValuesDialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  selected: string[];
  suggestions: string[];
  onRename: (from: string, to: string) => void;
  onDelete: (value: string) => void;
  onChange: (values: string[]) => void;
}) {
  if (!props.open) return null;
  return <ValuesDialogBody {...props} />;
}

interface ValueRow {
  orig: string;
  name: string;
  on: boolean;
  was: boolean;
  removed: boolean;
}

/**
 * Every value of the specification in one list, in alphabetical order: tick the ones that are on this product, rename any of them, or
 * remove them. Nothing changes until Save, which appears as soon as something has been changed. Closing with changes asks first.
 */
function ValuesDialogBody({ onClose, title, selected, suggestions, onRename, onDelete, onChange }: { onClose: () => void; title: string; selected: string[]; suggestions: string[]; onRename: (from: string, to: string) => void; onDelete: (value: string) => void; onChange: (values: string[]) => void }) {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const [rows, setRows] = useState<ValueRow[]>(() => alpha(uniqueValues([...selected, ...suggestions])).map((v) => ({ orig: v, name: v, on: selected.some((x) => same(x, v)), was: selected.some((x) => same(x, v)), removed: false })));
  const [asking, setAsking] = useState(false);
  /** Delete mode: a tick box appears at the end of each row, and the one Delete button above the list removes the ticked values. */
  const [deleting, setDeleting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const dirty = rows.some((r) => r.removed || (r.name.trim() !== "" && r.name.trim() !== r.orig) || r.on !== r.was);
  const patchRow = (orig: string, p: Partial<ValueRow>) => setRows((cur) => cur.map((r) => (r.orig === orig ? { ...r, ...p } : r)));

  const save = () => {
    const kept = rows.filter((r) => !r.removed);
    for (const r of rows.filter((x) => x.removed)) onDelete(r.orig);
    const finalName = (r: ValueRow) => (r.name.trim() || r.orig).trim();
    for (const r of kept) if (!same(finalName(r), r.orig)) onRename(r.orig, finalName(r));
    // Keep the order of the values already on the product, then add newly ticked ones alphabetically.
    const names = new Map(kept.map((r) => [r.orig.toLowerCase(), r]));
    const stay = selected.map((v) => names.get(v.toLowerCase())).filter((r): r is ValueRow => Boolean(r?.on));
    const added = kept.filter((r) => r.on && !stay.includes(r));
    onChange(uniqueValues([...stay.map(finalName), ...alpha(added.map(finalName))]));
    onClose();
  };

  return (
    <>
      <Dialog
        open
        onClose={() => (dirty ? setAsking(true) : onClose())}
        title={title}
        headerActions={
          <>
            {rows.some((r) => !r.removed) ? (
              <DeleteControls
                deleting={deleting}
                count={picked.size}
                onStart={() => setDeleting(true)}
                onCancel={() => {
                  setDeleting(false);
                  setPicked(new Set());
                }}
                onDelete={() => {
                  setRows((cur) => cur.map((r) => (picked.has(r.orig) ? { ...r, removed: true } : r)));
                  setPicked(new Set());
                  setDeleting(false);
                }}
              />
            ) : null}
            {dirty ? (
              <Button size="md" onClick={save}>
                Save
              </Button>
            ) : null}
          </>
        }
      >
        {rows.filter((r) => !r.removed).length === 0 ? <p className="text-sm text-text-muted">No values.</p> : null}
        <ul className="space-y-2">
          {rows
            .filter((r) => !r.removed)
            .map((r) => (
              <li key={r.orig} className="flex items-center gap-2">
                <input type="checkbox" aria-label={`${r.orig} is on this product`} checked={r.on} onChange={(e) => patchRow(r.orig, { on: e.target.checked })} className="size-5 shrink-0" />
                <input
                  aria-label={`Name of ${r.orig}`}
                  className={input}
                  value={r.name}
                  maxLength={200}
                  onKeyDown={(e) => {
                    // Enter must not submit the product form behind the window.
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  onChange={(e) => patchRow(r.orig, { name: e.target.value })}
                />
                {/* The box always takes its room, so the names do not shift when Delete is pressed. */}
                <span className="inline-flex size-9 shrink-0 items-center justify-center">
                  {deleting ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.orig} to delete`}
                      checked={picked.has(r.orig)}
                      onChange={(e) =>
                        setPicked((cur) => {
                          const next = new Set(cur);
                          if (e.target.checked) next.add(r.orig);
                          else next.delete(r.orig);
                          return next;
                        })
                      }
                      className="size-5 accent-[var(--color-danger)]"
                    />
                  ) : null}
                </span>
              </li>
            ))}
        </ul>
      </Dialog>
      <ConfirmDialog open={asking} onClose={() => setAsking(false)} title="Discard your changes?" description="Your changes have not been saved. Press Save in the top right to keep them." confirmLabel="Discard" destructive onConfirm={() => onClose()} />
    </>
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
        {box("d", "Length (L)")}
        {box("h", "Height (H)")}
        <PanelSelect compact label="Unit" value={d.unit} options={DIM_UNITS.map((u) => ({ value: u, label: u }))} onChange={(v) => set({ unit: v as DimUnit })} />
      </div>
      {row.legacyText ? <p className="mt-1.5 text-sm text-text-muted">Entered earlier as “{row.legacyText}”. It stays as it is until you fill in the boxes above.</p> : null}
    </div>
  );
}

/**
 * The "Add specification" control: a button that opens a searchable list of every type (built in and the staff's own).
 * Typing narrows the list; a name that is not there says "Not found" and Enter does nothing. A new type is made only with the
 * "Create specification" row: it asks for a name and whether the type holds one value or several, then saves it for every product.
 */
function AddSpecification({
  catalog,
  used,
  onAdd,
  onCreate,
  onRename,
  onDelete,
}: {
  catalog: SpecCatalogItem[];
  used: Set<string>;
  onAdd: (item: SpecCatalogItem) => void;
  onCreate: (label: string, valueType: "text" | "list") => Promise<void>;
  onRename: (key: string, label: string) => void;
  onDelete: (key: string) => void;
}) {
  const [typesOpen, setTypesOpen] = useState(false);
  const ownTypes = catalog.filter((c) => c.group === "Your own types");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [valueType, setValueType] = useState<"text" | "list">("text");
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = () => {
    setOpen(false);
    setQuery("");
    setCreating(false);
  };

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => catalog.filter((c) => !used.has(c.key) && (!q || c.label.toLowerCase().startsWith(q))).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })), [catalog, used, q]);
  const groups = useMemo(() => [...SPEC_GROUPS, "Your own types"].filter((g) => matches.some((m) => m.group === g)), [matches]);
  const ordered = useMemo(() => groups.flatMap((g) => matches.filter((m) => m.group === g)), [groups, matches]);

  const doCreate = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    await onCreate(query, valueType);
    setBusy(false);
    close();
  };

  const pick = (i: number) => {
    const c = ordered[i];
    if (!c) return;
    onAdd(c);
    close();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          setCreating(false);
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
              aria-activedescendant={!creating && ordered.length ? `${listId}-${active}` : undefined}
              data-dropdown-search
              aria-label={creating ? "Name of the new specification" : "Search specification types"}
              className="min-h-11 w-full bg-transparent py-2 text-[0.8125rem] outline-none placeholder:text-text-muted/70"
              placeholder={creating ? "Name the new specification" : "Search types"}
              maxLength={60}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && !creating) {
                  e.preventDefault();
                  setActive((a) => Math.min(ordered.length - 1, a + 1));
                } else if (e.key === "ArrowUp" && !creating) {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  // Enter picks a type that is in the list. It never makes a new one: only "Create specification" does.
                  e.preventDefault();
                  if (creating) void doCreate();
                  else pick(active);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
              }}
            />
          </div>

          {creating ? (
            <div className="space-y-3 border-b border-border p-3">
              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-text-muted">The specification holds</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["text", "One value", "e.g. Weight"],
                      ["list", "Several values", "e.g. Materials"],
                    ] as const
                  ).map(([v, name, hint]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={valueType === v}
                      onClick={() => setValueType(v)}
                      className={cn("border px-2 py-1.5 text-left text-[0.8125rem]", valueType === v ? "border-walnut-dark bg-walnut-dark text-ivory" : "border-border-strong hover:bg-black/5")}
                    >
                      <span className="block font-medium">{name}</span>
                      <span className={cn("block text-xs", valueType === v ? "text-ivory/80" : "text-text-muted")}>{hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="min-h-9 border border-border-strong px-3 text-[0.8125rem] hover:bg-black/5">
                  Back
                </button>
                <button type="button" onClick={() => void doCreate()} disabled={!query.trim() || busy} className="min-h-9 bg-walnut-dark px-3 text-[0.8125rem] font-medium text-ivory disabled:opacity-50">
                  {busy ? "Saving…" : "Create and add"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setCreating(true)} className="flex min-h-10 w-full items-center gap-2 border-b border-border px-3 text-left text-[0.8125rem] font-medium hover:bg-black/5">
                <Plus aria-hidden="true" className="size-4" />
                Create specification
              </button>
              <ul id={listId} role="listbox" aria-label="Specification types" className="max-h-72 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ordered.length === 0 ? (
                  <li className="px-3 py-3 text-[0.8125rem] text-text-muted">{q ? "Not found." : "Every type is already added."}</li>
                ) : null}
                {groups.map((g, gi) => (
                  // A line sets each main group apart from the one above it.
                  <li key={g} role="presentation" className={gi > 0 ? "mt-1 border-t border-border" : undefined}>
                    <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">{g}</p>
                    {matches
                      .filter((m) => m.group === g)
                      .map((c) => {
                        const i = ordered.indexOf(c);
                        return (
                          <div
                            key={c.key}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            onPointerEnter={() => setActive(i)}
                            onClick={() => pick(i)}
                            className={cn("cursor-pointer px-3 py-2 text-[0.8125rem]", i === active && "bg-black/5 font-medium")}
                          >
                            {c.label}
                          </div>
                        );
                      })}
                  </li>
                ))}
              </ul>
              {ownTypes.length > 0 ? (
                <button type="button" onClick={() => setTypesOpen(true)} className="flex min-h-10 w-full items-center gap-2 border-t border-border px-3 text-left text-[0.8125rem] hover:bg-black/5">
                  <Pencil aria-hidden="true" className="size-3.5" />
                  Edit your own types
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {typesOpen ? <OwnTypesDialog types={ownTypes} onRename={onRename} onDelete={onDelete} onClose={() => setTypesOpen(false)} /> : null}
      {!open ? <p className="mt-1.5 text-sm text-text-muted">Pick from the list of types, or create your own. Types you do not add are not shown on the product page.</p> : null}
    </div>
  );
}

/** The red Delete button in the top right of an edit window, left of Save. Pressed, tick boxes appear on the rows and it becomes Cancel and "Delete (n)". */
function DeleteControls({ deleting, count, onStart, onCancel, onDelete }: { deleting: boolean; count: number; onStart: () => void; onCancel: () => void; onDelete: () => void }) {
  return deleting ? (
    <>
      <Button type="button" size="md" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" size="md" variant="danger" disabled={count === 0} onClick={onDelete}>
        Delete{count > 0 ? ` (${count})` : ""}
      </Button>
    </>
  ) : (
    <Button type="button" size="md" variant="danger" onClick={onStart}>
      Delete
    </Button>
  );
}

/** The edit window for the staff's own specification types: change names or remove them, then Save. Closing with changes asks first. */
function OwnTypesDialog({ types, onRename, onDelete, onClose }: { types: SpecCatalogItem[]; onRename: (key: string, label: string) => void; onDelete: (key: string) => void; onClose: () => void }) {
  const [rows, setRows] = useState(() => types.map((t) => ({ key: t.key, orig: t.label, name: t.label, removed: false })));
  const [asking, setAsking] = useState(false);
  /** Delete mode, as in the values window: tick boxes at the end of each row and one Delete button above the list. */
  const [deleting, setDeleting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const dirty = rows.some((r) => r.removed || (r.name.trim() !== "" && r.name.trim() !== r.orig));
  const patchRow = (key: string, p: Partial<(typeof rows)[number]>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const save = () => {
    for (const r of rows) {
      if (r.removed) onDelete(r.key);
      else if (r.name.trim() && r.name.trim() !== r.orig) onRename(r.key, r.name.trim());
    }
    onClose();
  };
  const shown = rows.filter((r) => !r.removed);
  return (
    <>
      <Dialog
        open
        onClose={() => (dirty ? setAsking(true) : onClose())}
        title="Edit your own types"
        headerActions={
          <>
            {shown.length > 0 ? (
              <DeleteControls
                deleting={deleting}
                count={picked.size}
                onStart={() => setDeleting(true)}
                onCancel={() => {
                  setDeleting(false);
                  setPicked(new Set());
                }}
                onDelete={() => {
                  setRows((cur) => cur.map((r) => (picked.has(r.key) ? { ...r, removed: true } : r)));
                  setPicked(new Set());
                  setDeleting(false);
                }}
              />
            ) : null}
            {dirty ? (
              <Button size="md" onClick={save}>
                Save
              </Button>
            ) : null}
          </>
        }
      >
        {shown.length === 0 ? <p className="text-sm text-text-muted">You have no types of your own.</p> : null}
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              <input
                aria-label={`Name of ${r.orig}`}
                className={input}
                value={r.name}
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                onChange={(e) => patchRow(r.key, { name: e.target.value })}
              />
              <span className="inline-flex size-9 shrink-0 items-center justify-center">
                {deleting ? (
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.orig} to delete`}
                    checked={picked.has(r.key)}
                    onChange={(e) =>
                      setPicked((cur) => {
                        const next = new Set(cur);
                        if (e.target.checked) next.add(r.key);
                        else next.delete(r.key);
                        return next;
                      })
                    }
                    className="size-5 accent-[var(--color-danger)]"
                  />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
      <ConfirmDialog open={asking} onClose={() => setAsking(false)} title="Discard your changes?" description="Your changes have not been saved. Press Save in the top right to keep them." confirmLabel="Discard" destructive onConfirm={() => onClose()} />
    </>
  );
}
