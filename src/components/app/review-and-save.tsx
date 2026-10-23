"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PanelSelect } from "@/components/app/panel-select";
import { useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AvailabilityTag, type AvailabilityState } from "@/components/public/availability-tag";
import { Alert, StatusBadge } from "@/components/ui/status";
import { formatMoney } from "@/lib/money";
import { priceAfterDiscount, saleLabel } from "@/lib/sale";
import { AVAILABILITY_LABEL } from "@/lib/schemas/catalogue";
import { normalizeSpecs, specText, type SpecEntry } from "@/lib/specifications";

interface Preview {
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  visibility: string;
  featured: boolean;
  premium: boolean;
  availability: string;
  stock: string;
  price: string;
  discountKind: string;
  discountValue: string;
  kind: string;
  specs: Array<{ label: string; value: string }>;
  photos: Array<{ key: string; url: string }>;
  thumbnail: number;
}

function readForm(form: HTMLFormElement, categoryLabels: Record<string, string>): Preview {
  const fd = new FormData(form);
  const text = (k: string) => String(fd.get(k) ?? "").trim();
  let specs: SpecEntry[] = [];
  try {
    specs = normalizeSpecs(JSON.parse(text("specifications") || "[]") as SpecEntry[]);
  } catch {
    specs = [];
  }
  const photos = [...form.querySelectorAll<HTMLInputElement>('input[name="photos"]')].map((i) => ({ key: i.dataset.key ?? "", url: i.dataset.url ?? "" })).filter((p) => p.url);
  return {
    name: text("name"),
    category: categoryLabels[text("categoryId")] ?? "",
    shortDescription: text("shortDescription"),
    description: text("description"),
    visibility: text("visibility"),
    featured: fd.get("isFeatured") !== null,
    premium: fd.get("isPremium") !== null,
    availability: text("availability"),
    stock: text("stockQuantity"),
    price: text("listPrice"),
    discountKind: text("discountKind"),
    discountValue: text("discountValue"),
    kind: text("kind"),
    specs: specs.map((s) => ({ label: s.label, value: specText(s) })),
    photos,
    thumbnail: Math.max(1, Number(text("thumbnail")) || 1),
  };
}

/**
 * The form's save button. It first shows how the product will look (what is on the website and what is kept privately), and only
 * saves when the person confirms. If something obviously missing (the name, the category) would stop the save, it goes straight to the
 * form's own messages instead.
 */
export function ReviewAndSave({ categoryLabels, currency, confirmLabel, photosRequired = false }: { categoryLabels: Record<string, string>; currency: string; confirmLabel: string; photosRequired?: boolean }) {
  const { pending } = useFormState();
  const anchor = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);

  const review = () => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const p = readForm(form, categoryLabels);
    if (!p.name || !p.category || (p.availability === "in_stock" && !p.stock) || (photosRequired && p.photos.length === 0)) {
      form.requestSubmit();
      return;
    }
    setPreview(p);
    setOpen(true);
  };

  // Photo changes made in the preview go to the form's photo list (still unsaved), and the preview follows the list.
  const command = (detail: { action: "move" | "remove" | "thumb"; key: string; to?: string }) => anchor.current?.closest("form")?.dispatchEvent(new CustomEvent("photos-command", { detail }));
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [showroomPhoto, setShowroomPhoto] = useState(0);
  const categoryRef = useRef(categoryLabels);
  useEffect(() => {
    if (!open) return;
    const form = anchor.current?.closest("form");
    if (!form) return;
    const refresh = () => setPreview(readForm(form, categoryRef.current));
    form.addEventListener("photos-changed", refresh);
    return () => form.removeEventListener("photos-changed", refresh);
  }, [open]);

  const live = preview?.visibility === "published";
  const cover = preview ? (preview.photos[preview.thumbnail - 1] ?? preview.photos[0])?.url : undefined;

  return (
    <span ref={anchor}>
      <Button type="button" onClick={review} disabled={pending}>
        {pending ? "Saving…" : "Preview"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Preview" description="This is how the product will look. Nothing is saved until you confirm." wide>
        {preview ? (
          <div className="space-y-5">
            {live ? (
              <Alert tone="success">Not saved yet. It goes live on the website only when you press the confirm button below.</Alert>
            ) : (
              <Alert tone="warning">{preview.visibility === "archived" ? "Not saved yet. Once saved it is archived: hidden from the website and kept on record." : "Not saved yet. Once saved it stays a draft: hidden from the website until you publish it."}</Alert>
            )}

            {preview.premium ? (
              <section aria-label="How it appears in the premium showroom">
                <h4 className="mb-2 text-sm font-semibold">In the premium showroom</h4>
                <div className="prem-page border border-border">
                  <div className="prem-piece !py-6 px-4">
                    <div className="prem-gallery-wrap w-full max-w-sm">
                      <div className="pg">
                        <div className="pg-main">
                          {preview.photos.map((ph, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={ph.key} src={ph.url} alt="" className="pg-img absolute inset-0 size-full object-cover" data-on={i === Math.min(showroomPhoto, preview.photos.length - 1) ? "" : undefined} />
                          ))}
                          {preview.photos.length > 1 ? (
                            <span className="pg-count" aria-hidden="true">
                              {String(Math.min(showroomPhoto, preview.photos.length - 1) + 1).padStart(2, "0")} <i>/</i> {String(preview.photos.length).padStart(2, "0")}
                            </span>
                          ) : null}
                        </div>
                        {preview.photos.length > 0 ? (
                          <ul className="pg-thumbs" aria-label="Photographs">
                            {preview.photos.map((ph, i) => (
                              <li key={ph.key}>
                                <button
                                  type="button"
                                  onClick={() => setShowroomPhoto(i)}
                                  aria-label={`Show photograph ${i + 1}`}
                                  className={"pg-thumb" + (i === Math.min(showroomPhoto, preview.photos.length - 1) ? " is-on" : "")}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={ph.url} alt="" className="size-full object-cover" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                    <div className="prem-info">
                      <h2 className="prem-piece-name">{preview.name}</h2>
                      {preview.description ? (
                        <div className="prem-piece-text">
                          {preview.description
                            .split(/\n{2,}/)
                            .map((para) => para.trim())
                            .filter(Boolean)
                            .map((para, k) => (
                              <p key={k} className="whitespace-pre-line">
                                {para}
                              </p>
                            ))}
                        </div>
                      ) : (
                        <p className="prem-piece-text">No detailed description yet. The showroom lists the long description here.</p>
                      )}
                      <span className="prem-cta">View</span>
                    </div>
                  </div>
                </div>
                {!preview.featured ? <p className="mt-2 text-sm font-medium text-warning">Not shown in the premium range yet: it also needs “Featured on the homepage” ticked.</p> : null}
                {preview.visibility !== "published" ? <p className="mt-2 text-sm font-medium text-warning">Premium pieces only appear once the product is published.</p> : null}
              </section>
            ) : null}

            {preview.premium ? <h4 className="text-sm font-semibold">On the product page and in the collection</h4> : null}
            <div className="grid gap-5 md:grid-cols-[15rem_1fr]">
              <div>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" className="aspect-square w-full max-w-60 border border-border object-cover" />
                ) : (
                  <div className="flex aspect-square w-full max-w-60 items-center justify-center border border-dashed border-border-strong text-sm text-text-muted">No photos</div>
                )}
                {preview.photos.length > 0 ? (
                  <ul className="mt-2 grid max-w-60 grid-cols-3 gap-1.5" aria-label="Photos in order">
                    {preview.photos.map((p, i) => (
                      <li
                        key={p.key}
                        draggable
                        onDragStart={() => setDragKey(p.key)}
                        onDragOver={(e) => dragKey && e.preventDefault()}
                        onDrop={() => {
                          if (dragKey) command({ action: "move", key: dragKey, to: p.key });
                          setDragKey(null);
                        }}
                        onDragEnd={() => setDragKey(null)}
                        className={"relative cursor-grab " + (dragKey === p.key ? "opacity-40" : "")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" draggable={false} className="aspect-square w-full border border-border object-cover" />
                        <span className="tabular absolute left-0.5 top-0.5 bg-walnut-dark px-1 text-[0.6875rem] text-ivory">{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => command({ action: "remove", key: p.key })}
                          aria-label={`Delete photo ${i + 1}`}
                          className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center rounded-full bg-white/90 shadow hover:bg-danger hover:text-ivory"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                        {i === Math.min(preview.thumbnail, preview.photos.length) - 1 ? <span className="absolute inset-x-0 bottom-0 bg-walnut-dark/85 text-center text-[0.6875rem] text-ivory">Thumbnail</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {preview.photos.length ? (
                  <div className="mt-3 max-w-60">
                    <PanelSelect
                      label="Thumbnail photo"
                      value={String(Math.min(preview.thumbnail, preview.photos.length))}
                      options={preview.photos.map((_, i) => ({ value: String(i + 1), label: `Photo ${i + 1}` }))}
                      onChange={(v) => command({ action: "thumb", key: preview.photos[Number(v) - 1]!.key })}
                    />
                  </div>
                ) : null}
                {preview.photos.length > 1 ? <p className="mt-1.5 text-xs text-text-muted">Drag a photo to change its number. Changes here are kept with the form and saved only when you confirm.</p> : null}
              </div>

              <div className="min-w-0">
                <p className="text-sm text-text-muted">{preview.category}</p>
                <h3 className="mt-0.5 text-xl font-semibold">{preview.name}</h3>
                {preview.shortDescription ? <p className="mt-1 text-sm">{preview.shortDescription}</p> : null}
                {(() => {
                  const now = priceAfterDiscount(preview.price, preview.discountKind, preview.discountValue);
                  const label = now ? saleLabel({ kind: preview.discountKind as "amount" | "percent", value: preview.discountValue }, now, preview.price, (a) => formatMoney(a, currency)) : null;
                  if (!preview.price) return <p className="mt-3 text-lg font-medium"><span className="text-sm font-normal text-text-muted">No price: customers are asked to contact you</span></p>;
                  if (!now) return <p className="mt-3 text-lg font-medium">{formatMoney(preview.price, currency)}</p>;
                  return (
                    <p className="mt-3 text-lg font-medium">
                      <del className="mr-2 text-text-muted">{formatMoney(preview.price, currency)}</del>
                      {formatMoney(now, currency)}
                      {label ? <span className="ml-2 inline-flex bg-[#f4d03f] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-black">{label}</span> : null}
                    </p>
                  );
                })()}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.availability ? <AvailabilityTag state={preview.availability === "on_request" ? "made_to_order" : (preview.availability as AvailabilityState)}>{AVAILABILITY_LABEL[preview.availability as keyof typeof AVAILABILITY_LABEL]}{preview.availability === "in_stock" && preview.stock ? `: ${preview.stock} available` : ""}</AvailabilityTag> : null}
                  {preview.featured ? <StatusBadge tone="info">Featured on the homepage</StatusBadge> : null}
                  {preview.premium ? <span className="inline-flex items-center border border-walnut-dark bg-walnut-dark px-2 py-0.5 text-xs font-medium text-ivory">Premium range</span> : null}
                </div>

                <h4 className="mt-5 text-sm font-semibold">Specifications</h4>
                <dl className="mt-1.5 divide-y divide-border border-y border-border text-sm">
                  <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5">
                    <dt className="text-text-muted">Type</dt>
                    <dd>{preview.kind === "made_to_order" ? "Made to order" : "Ready-made"}</dd>
                  </div>
                  {preview.specs.map((s, i) => (
                    <div key={i} className="grid grid-cols-[9rem_1fr] gap-3 py-1.5">
                      <dt className="text-text-muted">{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {preview.description ? (
              <div>
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="mt-1 whitespace-pre-line text-sm">{preview.description}</p>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
                Keep editing
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  anchor.current?.closest("form")?.requestSubmit();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </span>
  );
}
