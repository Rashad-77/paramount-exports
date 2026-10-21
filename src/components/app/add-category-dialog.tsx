"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FPanelSelect } from "@/components/app/panel-select";
import { ActionForm, FField, SubmitButton, useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionState } from "@/lib/action-state";
import { cleanInput } from "@/lib/input-kinds";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** Closes the pop-up once the category has been saved (the message arrives as a toast). */
export function CloseOnSuccess({ onClose }: { onClose: () => void }) {
  const { state } = useFormState();
  useEffect(() => {
    if (state.ok) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return null;
}

/** The names of subcategories to create along with a new main category: type one, press Enter or Add, and it joins the list. */
function SubcategoryList({ names, setNames }: { names: string[]; setNames: (n: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const name = text.trim();
    if (!name) return;
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) setNames([...names, name]);
    setText("");
  };
  return (
    <div className="space-y-2">
      <label htmlFor="new-sub" className="text-sm font-medium tracking-[0.01em] text-text">
        Subcategories <span className="font-normal text-text-muted">(optional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id="new-sub"
          value={text}
          maxLength={80}
          placeholder="Name of a subcategory"
          onChange={(e) => setText(cleanInput("title", e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="text-[0.8125rem] h-10 min-w-0 flex-1 border border-border-strong bg-surface px-3"
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!text.trim()}>
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      </div>
      {names.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Subcategories to add">
          {names.map((n) => (
            <li key={n} className="flex items-center gap-1.5 border border-border bg-linen py-1 pl-2.5 pr-1.5 text-[0.8125rem]">
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))} className="p-0.5 text-text-muted hover:text-text">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input type="hidden" name="subs" value={JSON.stringify(names)} />
      <p className="text-[0.8125rem] text-text-muted">They are created together with the main category. You can add more later.</p>
    </div>
  );
}

function Fields({ groups }: { groups: Array<{ id: string; name: string }> }) {
  const { state } = useFormState();
  const [kind, setKind] = useState<"main" | "sub">(state.values?.kind === "sub" ? "sub" : "main");
  const [subs, setSubs] = useState<string[]>([]);
  const sub = kind === "sub";
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium tracking-[0.01em] text-text">What are you adding?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["main", "Main category", "A top-level group, such as Furniture."],
              ["sub", "Subcategory", "Sits under a main category, such as Tables under Furniture."],
            ] as const
          ).map(([value, title, hint]) => (
            <label key={value} className={"flex cursor-pointer items-start gap-3 border p-3 " + (kind === value ? "border-walnut-dark bg-linen" : "border-border")}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="mt-0.5" />
              <span className="text-sm">
                <span className="block font-medium">{title}</span>
                <span className="block text-[0.8125rem] text-text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {sub ? (
        <FPanelSelect
          name="parentId"
          label="Which main category is it under?"
          required
          placeholder="Choose a main category"
          defaultValue={state.values?.parentId ?? ""}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      ) : null}

      <FField name="name" kind="title" label={sub ? "Subcategory name" : "Category name"} required maxLength={80} defaultValue={state.values?.name ?? ""} hint="The web address is made from the name automatically." />

      {sub ? null : <SubcategoryList names={subs} setNames={setSubs} />}
    </>
  );
}

/** The Add category button and its pop-up. */
export function AddCategoryDialog({
  action,
  groups,
  defaultOpen = false,
  label = "Add category",
}: {
  action: Action;
  groups: Array<{ id: string; name: string }>;
  defaultOpen?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => {
    setOpen(false);
    // Drop the ?add=1 that opened it from a link.
    if (new URLSearchParams(window.location.search).has("add")) window.history.replaceState(null, "", window.location.pathname);
  };
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={close} title="Add category">
        {open ? (
          <ActionForm action={action}>
            <CloseOnSuccess onClose={close} />
            <Fields groups={groups} />
            <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
          </ActionForm>
        ) : null}
      </Dialog>
    </>
  );
}
