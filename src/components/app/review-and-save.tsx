"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProductPagePreview, type PreviewInput } from "@/components/app/product-page-preview";
import type { ProductViewShop } from "@/components/public/product-view";
import { Alert } from "@/components/ui/status";
import { normalizeSpecs, type SpecEntry } from "@/lib/specifications";

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
  specEntries: SpecEntry[];
  photos: Array<{ key: string; url: string; x: number; y: number; z: number }>;
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
  // Each photo input holds "id:…@x,y,z" or "file:…@x,y,z": where the photograph sits in its frame and how far it is zoomed.
  const photos = [...form.querySelectorAll<HTMLInputElement>('input[name="photos"]')]
    .map((i) => {
      const at = /@(\d{1,3}),(\d{1,3})(?:,(\d{1,3}))?$/.exec(i.value);
      return { key: i.dataset.key ?? "", url: i.dataset.url ?? "", x: at ? Number(at[1]) : 50, y: at ? Number(at[2]) : 50, z: at?.[3] ? Number(at[3]) : 100 };
    })
    .filter((p) => p.url);
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
    specEntries: specs,
    photos,
  };
}

/**
 * The form's save button. It first shows how the product will look (what is on the website and what is kept privately), and only
 * saves when the person confirms. If something obviously missing (the name, the category) would stop the save, it goes straight to the
 * form's own messages instead.
 */
export function ReviewAndSave({ categoryLabels, currency, shop, confirmLabel, photosRequired = false }: { categoryLabels: Record<string, string>; currency: string; shop?: Omit<ProductViewShop, "currency">; confirmLabel: string; photosRequired?: boolean }) {
  const { pending } = useFormState();
  const anchor = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);

  const review = () => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const p = readForm(form, categoryLabels);
    // (An available piece does not need an amount: left blank it is just shown as available.)
    if (!p.name || !p.category || (photosRequired && p.photos.length === 0)) {
      form.requestSubmit();
      return;
    }
    setPreview(p);
    setOpen(true);
  };

  // The preview follows the form's photo list (a photo added, removed or moved there shows here at once).
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
                <div className="prem-page prem-preview border border-border">
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

            {preview.premium ? <h4 className="text-sm font-semibold">On the product page</h4> : null}
            <ProductPagePreview
              shop={{ currency, address: shop?.address ?? null, openingHours: shop?.openingHours ?? null, mapUrl: shop?.mapUrl ?? null }}
              input={{
                name: preview.name,
                category: preview.category,
                shortDescription: preview.shortDescription,
                description: preview.description,
                premium: preview.premium,
                availability: preview.availability,
                stock: preview.stock,
                price: preview.price,
                discountKind: preview.discountKind,
                discountValue: preview.discountValue,
                kind: preview.kind,
                specEntries: preview.specEntries,
                photos: preview.photos,
              } satisfies PreviewInput}
            />

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
