"use client";

import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { uploadToStorage } from "@/components/forms/file-uploader";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Height of a band as a share of its width, as on a computer (a 1440px page has a band about 208px tall). */
const BAND_RATIO = "1440 / 208";

/**
 * The text of the band, as it will read on the website. It never moves: only the picture behind it can be placed.
 * Used by the pop-up preview and by the small preview in the form.
 */
function BandText({ name, subs }: { name: string; subs: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex select-none flex-col justify-center bg-gradient-to-r from-black/60 via-black/35 to-black/10 px-[4%]">
      <span className="font-display block text-[clamp(1.1rem,3.2cqw,2rem)] leading-tight text-white">{name || "Category name"}</span>
      {subs.length > 0 ? <span className="mt-1.5 block max-w-[34rem] text-[clamp(0.55rem,1.15cqw,0.8rem)] font-semibold uppercase leading-snug tracking-[0.14em] text-white/85">{subs.slice(0, 6).join(" · ")}</span> : null}
    </div>
  );
}

/**
 * The "Category banner image" field of a main category: choose a picture, then press the pencil to drag it to where it should sit in the
 * band. The picture goes straight to storage; the form only carries the file's id and the chosen position.
 */
export function BannerImageField({ initialUrl = null, initialX = 50, initialY = 50, subNames = [] }: { initialUrl?: string | null; initialX?: number; initialY?: number; subNames?: string[] }) {
  const inputId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [fileId, setFileId] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState<{ name: string; subs: string[] }>({ name: "", subs: subNames });
  const blobUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  const flagForm = (b: boolean) => {
    const form = root.current?.closest("form");
    if (form) form.dataset.uploading = b ? "true" : "false";
  };

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    flagForm(true);
    try {
      const id = await uploadToStorage(file, "catalogue");
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(file);
      setUrl(blobUrl.current);
      setFileId(id);
      setRemoved(false);
      setPos({ x: 50, y: 50 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
      flagForm(false);
    }
  }

  function remove() {
    setUrl(null);
    setFileId(null);
    setRemoved(Boolean(initialUrl));
    setPos({ x: 50, y: 50 });
  }

  function openEditor() {
    // The band text comes from what has been typed in the form so far.
    const form = root.current?.closest("form");
    const name = (form?.elements.namedItem("name") as HTMLInputElement | null)?.value?.trim() ?? "";
    let subs = subNames;
    const raw = (form?.elements.namedItem("subs") as HTMLInputElement | null)?.value;
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) subs = parsed.filter((s): s is string => typeof s === "string");
      } catch {
        /* keep the names given */
      }
    }
    setPreview({ name, subs });
    setEditing(true);
  }

  return (
    <div ref={root} className="space-y-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium tracking-[0.01em] text-text">
          Category banner image <span className="font-normal text-text-muted">(optional)</span>
        </label>
        {url ? (
          <button type="button" onClick={openEditor} aria-label="Edit where the picture sits in the banner" title="Edit placement" className="inline-flex size-7 items-center justify-center text-text-muted outline-none hover:bg-linen hover:text-text focus-visible:bg-linen">
            <Pencil aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {url ? (
        <div className="flex items-center gap-3">
          <div className="relative w-48 shrink-0 overflow-hidden bg-linen" style={{ aspectRatio: BAND_RATIO }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" draggable={false} className="absolute inset-0 size-full object-cover" style={{ objectPosition: `${pos.x}% ${pos.y}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} className="inline-flex h-9 cursor-pointer items-center gap-2 border border-border-strong bg-surface px-3 text-[0.8125rem] font-medium hover:bg-linen">
              <ImagePlus aria-hidden="true" className="size-4" />
              {busy ? "Uploading…" : "Change"}
            </label>
            <button type="button" onClick={remove} className="inline-flex h-9 items-center gap-2 border border-border-strong bg-surface px-3 text-[0.8125rem] font-medium hover:bg-linen">
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label htmlFor={inputId} className="flex min-h-12 cursor-pointer items-center gap-3 border border-dashed border-border-strong bg-surface px-4 py-3 text-sm hover:border-walnut">
          <ImagePlus aria-hidden="true" className="size-4 shrink-0 text-stone" />
          <span className="font-medium">{busy ? "Uploading…" : "Choose a picture"}</span>
        </label>
      )}
      {error ? <p className="text-[0.8125rem] text-danger">{error}</p> : null}
      <p className="text-[0.8125rem] text-text-muted">Shown behind the category’s band on the homepage. A wide picture works best.</p>

      {fileId ? <input type="hidden" name="bannerFileId" value={fileId} /> : null}
      {removed ? <input type="hidden" name="removeBanner" value="1" /> : null}
      <input type="hidden" name="bannerX" value={pos.x} />
      <input type="hidden" name="bannerY" value={pos.y} />

      {url && editing ? (
        <PlacementDialog
          open
          url={url}
          start={pos}
          name={preview.name}
          subs={preview.subs}
          onClose={() => setEditing(false)}
          onSave={(p) => {
            setPos(p);
            setEditing(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** The pop-up: the band as it will look, with the text fixed and the picture underneath it, dragged with the mouse (or a finger). */
function PlacementDialog({ open, url, start, name, subs, onClose, onSave }: { open: boolean; url: string; start: { x: number; y: number }; name: string; subs: string[]; onClose: () => void; onSave: (p: { x: number; y: number }) => void }) {
  const [pos, setPos] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    setDragging(true);
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = box.current;
    const n = natural.current;
    if (!d || !el || !n) return;
    const r = el.getBoundingClientRect();
    // object-fit: cover scales the picture to fill the band; only what overflows can be moved, so a pixel of dragging is worth 100% / overflow.
    const scale = Math.max(r.width / n.w, r.height / n.h);
    const overX = n.w * scale - r.width;
    const overY = n.h * scale - r.height;
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    setPos({
      x: overX > 0.5 ? Math.round(clamp(d.x - ((e.clientX - d.px) / overX) * 100)) : d.x,
      y: overY > 0.5 ? Math.round(clamp(d.y - ((e.clientY - d.py) / overY) * 100)) : d.y,
    });
  }
  function onUp() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Banner picture" description="Drag the picture to choose which part shows. The text stays where it is." wide plainClose>
      <div className="space-y-5">
        <div
          ref={box}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={"@container relative w-full touch-none select-none overflow-hidden bg-linen " + (dragging ? "cursor-grabbing" : "cursor-grab")}
          style={{ aspectRatio: BAND_RATIO }}
        >
          {/* The picture is the lowest layer and is clipped by the band: it never pokes out. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
            }}
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
          />
          <BandText name={name} subs={subs} />
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={() => onSave(pos)}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
