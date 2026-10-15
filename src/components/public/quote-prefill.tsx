"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const clean = (v: string | null, max: number) => (v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

/**
 * Inside the quotation form: when the visitor arrives from a product page ("Request a quote"), the piece is already filled in.
 * It fills only boxes that are still empty, links the quotation to the product, and says so above the fields.
 * (The product number in the address is checked again on the server; a wrong one is simply refused.)
 */
export function QuotePrefill() {
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const productId = /^[0-9a-f-]{36}$/i.test(params.get("product") ?? "") ? params.get("product")! : "";
  const item = clean(params.get("item"), 120);
  const wood = clean(params.get("wood"), 120);
  const finish = clean(params.get("finish"), 120);
  const size = clean(params.get("size"), 200);

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const fill = (name: string, value: string) => {
      const el = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (!el || !value || el.value) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    fill("furnitureType", item);
    fill("material", wood);
    fill("finish", finish);
    fill("dimensions", size);
  }, [item, wood, finish, size]);

  return (
    <div ref={box}>
      {productId ? <input type="hidden" name="productId" value={productId} /> : null}
      {item ? (
        <p className="quote-from">
          Quotation for <strong>{item}</strong>. Change anything below to suit what you need.
        </p>
      ) : null}
    </div>
  );
}
