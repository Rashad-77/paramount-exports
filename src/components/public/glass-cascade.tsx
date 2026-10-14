"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export interface CascadeGroup {
  slug: string;
  name: string;
  children: Array<{ slug: string; name: string }>;
}

/**
 * The frosted-glass drop-down for a two-level list: the main list holds "All" and the groups; a group with categories under it has a
 * chevron, and pressing it opens its own list to the side, joined to the main one. The chevron points right when closed and left when
 * open. Keyboard: Up / Down move, Right opens a group's list, Left goes back, Enter picks, Escape closes (the side list first).
 * On a phone the side list slides over the main one instead, with a Back row, as there is no room beside it.
 */
export function GlassCascade({ label, allLabel, groups, value, onChange }: { label: string; allLabel: string; groups: CascadeGroup[]; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // index in the main list: 0 is "All", then the groups
  const [side, setSide] = useState<number | null>(null); // the group whose list is open
  const [sideActive, setSideActive] = useState(0); // 0 is "All <group>", then its categories
  const [inSide, setInSide] = useState(false);

  const mainCount = groups.length + 1;
  const groupAt = (i: number) => (i > 0 ? groups[i - 1] : undefined);
  const sideGroup = side !== null ? groupAt(side) : undefined;
  const sideOptions = sideGroup ? [{ slug: sideGroup.slug, name: `All ${sideGroup.name}` }, ...sideGroup.children] : [];

  const owner = groups.find((g) => g.slug === value || g.children.some((c) => c.slug === value));
  const chosen = value ? (owner?.slug === value ? owner.name : (owner?.children.find((c) => c.slug === value)?.name ?? allLabel)) : allLabel;
  const isSelected = (g?: CascadeGroup) => (g ? owner?.slug === g.slug : value === "");

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const closeSide = () => {
    setSide(null);
    setInSide(false);
  };
  const show = () => {
    setActive(owner ? groups.indexOf(owner) + 1 : 0);
    closeSide();
    setOpen(true);
  };
  const choose = (slug: string) => {
    onChange(slug);
    setOpen(false);
    closeSide();
  };
  const openSide = (i: number) => {
    const g = groupAt(i);
    if (!g || g.children.length === 0) return;
    setActive(i);
    setSide(i);
    setSideActive(0);
    setInSide(true);
  };
  const press = (i: number) => {
    const g = groupAt(i);
    if (!g) choose("");
    else if (g.children.length === 0) choose(g.slug);
    else openSide(i);
  };
  // With a mouse, a group's list opens as soon as the pointer is on it, and the one before closes; a touch screen uses the press.
  const hover = (e: React.PointerEvent, i: number) => {
    setActive(i);
    setInSide(false);
    if (e.pointerType !== "mouse") return;
    const g = groupAt(i);
    if (g && g.children.length > 0) {
      setSide(i);
      setSideActive(0);
    } else setSide(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (inSide && sideGroup) {
      const last = sideOptions.length - 1;
      if (e.key === "ArrowDown") setSideActive((a) => Math.min(last, a + 1));
      else if (e.key === "ArrowUp") setSideActive((a) => Math.max(0, a - 1));
      else if (e.key === "ArrowLeft" || e.key === "Escape") closeSide();
      else if (e.key === "Enter" || e.key === " ") choose(sideOptions[sideActive]?.slug ?? "");
      else if (e.key === "Tab") setOpen(false);
      else return;
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      setActive((a) => Math.min(mainCount - 1, a + 1));
      closeSide();
    } else if (e.key === "ArrowUp") {
      setActive((a) => Math.max(0, a - 1));
      closeSide();
    } else if (e.key === "ArrowRight") openSide(active);
    else if (e.key === "Enter" || e.key === " ") press(active);
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else return;
    e.preventDefault();
  };

  const activeId = !open ? undefined : inSide && side !== null ? `${id}-s${sideActive}` : `${id}-m${active}`;

  return (
    <div ref={root} className="gs gc" data-open={open || undefined}>
      <button
        type="button"
        role="combobox"
        aria-label={`${label}, ${chosen}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-main`}
        aria-activedescendant={activeId}
        className="cat-control gs-button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="gs-label">{chosen}</span>
        <span aria-hidden="true" className="gs-sizer">
          <span>{allLabel}</span>
          {groups.map((g) => (
            <span key={g.slug}>{g.name}</span>
          ))}
        </span>
      </button>
      {open ? (
        <>
          <ul id={`${id}-main`} role="listbox" aria-label={label} className="gs-panel gc-main">
            <li
              id={`${id}-m0`}
              role="option"
              aria-selected={isSelected()}
              data-active={(!inSide && active === 0) || undefined}
              className="gs-opt"
              onPointerEnter={(e) => hover(e, 0)}
              onClick={() => press(0)}
            >
              {allLabel}
            </li>
            {groups.map((g, k) => {
              const i = k + 1;
              const has = g.children.length > 0;
              return (
                <li
                  key={g.slug}
                  id={`${id}-m${i}`}
                  role="option"
                  aria-selected={isSelected(g)}
                  data-active={(active === i && (!inSide || side === i)) || undefined}
                  className="gs-opt gc-row"
                  onPointerEnter={(e) => hover(e, i)}
                  onClick={() => press(i)}
                >
                  <span>{g.name}</span>
                  {has ? side === i ? <ChevronLeft aria-hidden="true" className="gc-chev" strokeWidth={1.75} /> : <ChevronRight aria-hidden="true" className="gc-chev" strokeWidth={1.75} /> : null}
                </li>
              );
            })}
          </ul>
          {sideGroup ? (
            <ul role="listbox" aria-label={sideGroup.name} className="gs-panel gc-side">
              <li role="presentation" className="gc-back" onClick={closeSide}>
                <ChevronLeft aria-hidden="true" className="gc-chev" strokeWidth={1.75} /> Back
              </li>
              {sideOptions.map((o, j) => (
                <li
                  key={o.slug}
                  id={`${id}-s${j}`}
                  role="option"
                  aria-selected={value === o.slug}
                  data-active={(inSide && sideActive === j) || undefined}
                  className="gs-opt"
                  onPointerEnter={() => {
                    setInSide(true);
                    setSideActive(j);
                  }}
                  onClick={() => choose(o.slug)}
                >
                  {o.name}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
