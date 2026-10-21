"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import { uploadToStorage } from "@/components/forms/file-uploader";
import { SelectField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { MAX_PHOTOS } from "@/lib/schemas/catalogue";

interface Photo {
  key: string;
  /** An existing photo of the product. */
  id?: string;
  /** A photo uploaded on this page and not saved yet. */
  fileId?: string;
  url: string;
  state: "uploading" | "done" | "error";
  error?: string;
}

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The product's photographs: add them first, then they appear below in order, numbered. Drag a photo to change its number (or focus it and
 * press Alt + an arrow key). The thumbnail is chosen by number, separately from the order. Everything is saved with the product:
 * the form posts `photos` in the order shown and `thumbnail` as the chosen number.
 */
export function PhotosEditor({
  initial,
  thumbnailId,
}: {
  initial: Array<{ id: string; url: string }>;
  thumbnailId?: string | null;
}) {
  const inputId = useId();
  const { state } = useFormState();
  const missing = state.fieldErrors?.photos?.[0];
  const root = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<Photo[]>(() => initial.map((p) => ({ key: p.id, id: p.id, url: p.url, state: "done" as const })));
  const [thumbKey, setThumbKey] = useState<string | undefined>(() => (initial.find((p) => p.id === thumbnailId) ?? initial[0])?.id);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const uploading = photos.some((p) => p.state === "uploading");

  // Tell the surrounding form not to submit while a transfer is running (the form's own guard reads this flag).
  useEffect(() => {
    const form = root.current?.closest("form");
    if (form) form.dataset.uploading = uploading ? "true" : "false";
  }, [uploading]);

  // The save preview can reorder, delete and pick the thumbnail too: it sends commands here, and is told when anything changes.
  const commandRef = useRef<(d: { action: "move" | "remove" | "thumb"; key: string; to?: string }) => void>(() => undefined);
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const onCommand = (e: Event) => commandRef.current((e as CustomEvent).detail);
    form.addEventListener("photos-command", onCommand);
    return () => form.removeEventListener("photos-command", onCommand);
  }, []);
  useEffect(() => {
    root.current?.closest("form")?.dispatchEvent(new CustomEvent("photos-changed"));
  }, [photos, thumbKey]);

  const patch = (key: string, p: Partial<Photo>) => setPhotos((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const ready = photos.filter((p) => p.state === "done");
  const thumbIndex = Math.max(0, ready.findIndex((p) => p.key === thumbKey));

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setNotice(null);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > picked.length) setNotice(`A product can have up to ${MAX_PHOTOS} photos.`);
    const added: Photo[] = picked.map((f, n) => ({
      key: `new-${Date.now()}-${n}`,
      url: URL.createObjectURL(f),
      state: f.size > MAX_BYTES ? "error" : "uploading",
      error: f.size > MAX_BYTES ? `${f.name} is over 8 MB.` : undefined,
    }));
    setPhotos((cur) => [...cur, ...added]);
    await Promise.all(
      picked.map(async (f, n) => {
        const item = added[n]!;
        if (item.state === "error") return;
        try {
          patch(item.key, { state: "done", fileId: await uploadToStorage(f, "catalogue") });
        } catch (e) {
          patch(item.key, { state: "error", error: e instanceof Error ? e.message : "The upload failed." });
        }
      }),
    );
  }

  const move = (from: string, to: string) => {
    if (from === to) return;
    setPhotos((cur) => {
      const a = cur.findIndex((p) => p.key === from);
      const b = cur.findIndex((p) => p.key === to);
      if (a < 0 || b < 0) return cur;
      const next = [...cur];
      const [item] = next.splice(a, 1);
      next.splice(b, 0, item!);
      return next;
    });
  };

  const remove = (key: string) => {
    setPhotos((cur) => cur.filter((p) => p.key !== key));
    if (thumbKey === key) setThumbKey(undefined);
  };

  useEffect(() => {
    commandRef.current = (d) => {
      if (d.action === "move" && d.to) move(d.key, d.to);
      else if (d.action === "remove") remove(d.key);
      else if (d.action === "thumb") setThumbKey(d.key);
    };
  });

  const onKey = (e: React.KeyboardEvent, key: string, i: number) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const to = photos[e.key === "ArrowLeft" ? i - 1 : i + 1];
    if (!to) return;
    e.preventDefault();
    move(key, to.key);
    // Keep focus on the photo that moved.
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-photo="${key}"]`)?.focus());
  };

  return (
    <div ref={root} className="space-y-4">
      <div aria-invalid={missing ? true : undefined} tabIndex={missing ? -1 : undefined} className="outline-none">
        <label htmlFor={inputId} className={cn("flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed bg-surface px-4 py-5 text-center text-sm hover:border-walnut hover:bg-linen", missing ? "border-danger" : "border-border-strong")}>
          <ImagePlus aria-hidden="true" className="size-6 text-stone" />
          <span className="font-medium">Add photos</span>
          <span className="text-text-muted">JPEG, PNG or WebP, up to 8 MB each. You can pick several at once.</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <div aria-live="polite" className="mt-2 text-sm">
          {uploading ? <p className="text-text-muted">Uploading… please wait before saving.</p> : null}
          {notice ? <p className="font-medium text-danger">{notice}</p> : null}
          {missing ? <p role="alert" className="font-medium text-danger">{missing}</p> : null}
        </div>
      </div>

      {photos.length > 0 ? (
        <>
          <ul aria-label="Photos, in order" className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li
                key={p.key}
                data-photo={p.key}
                tabIndex={0}
                draggable={p.state === "done"}
                aria-label={`Photo ${i + 1}${p.key === thumbKey ? ", thumbnail" : ""}. Drag, or press Alt and an arrow key, to change its number.`}
                onKeyDown={(e) => onKey(e, p.key, i)}
                onDragStart={(e) => {
                  setDragKey(p.key);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", p.key);
                }}
                onDragOver={(e) => {
                  if (!dragKey) return;
                  e.preventDefault();
                  setOverKey(p.key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragKey) move(dragKey, p.key);
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                className={cn(
                  "relative aspect-square cursor-grab touch-manipulation overflow-hidden border bg-linen outline-none focus-visible:ring-2 focus-visible:ring-walnut active:cursor-grabbing",
                  p.state === "error" ? "border-danger" : "border-border",
                  dragKey === p.key && "opacity-40",
                  overKey === p.key && dragKey !== p.key && "ring-2 ring-walnut",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" draggable={false} className={cn("size-full object-cover", p.state === "uploading" && "opacity-50")} />
                <span className="tabular absolute left-1.5 top-1.5 inline-flex size-6 items-center justify-center bg-walnut-dark text-xs font-semibold text-ivory">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  aria-label={`Delete photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-text shadow transition-colors hover:bg-danger hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
                {p.state === "uploading" ? <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-xs text-white">Uploading…</span> : null}
                {p.state === "error" ? <span className="absolute inset-x-0 bottom-0 bg-danger px-1 py-0.5 text-center text-xs text-white">{p.error ?? "Failed"}</span> : null}
                {p.state === "done" && p.key === thumbKey ? <span className="absolute inset-x-0 bottom-0 bg-walnut-dark/85 py-0.5 text-center text-xs font-medium text-ivory">Thumbnail</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">Drag a photo to change its number. Photo 1 is the first one shown on the product page. Deleted photos are removed when you save.</p>
        </>
      ) : (
        <p className="text-sm text-text-muted">No photos yet.</p>
      )}

      {ready.length > 0 ? (
        <SelectField
          label="Thumbnail photo"
          hint="The photo shown on cards and lists. Choose it by number."
          value={String(thumbIndex + 1)}
          onValueChange={(v) => setThumbKey(ready[Number(v) - 1]?.key)}
          options={ready.map((_, i) => ({ value: String(i + 1), label: `Photo ${i + 1}` }))}
          className="max-w-md"
        />
      ) : null}

      {/* What the form posts: the photos in order, and the thumbnail's number. */}
      {ready.map((p) => (
        <input key={p.key} type="hidden" name="photos" value={p.id ? `id:${p.id}` : `file:${p.fileId}`} data-url={p.url} data-key={p.key} />
      ))}
      {ready.length > 0 ? <input type="hidden" name="thumbnail" value={thumbIndex + 1} /> : null}
    </div>
  );
}
