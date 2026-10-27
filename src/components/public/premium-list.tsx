"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PremiumGallery } from "./premium-gallery";
import { Reveal } from "./reveal";
import type { PremiumPiece } from "@/server/catalogue-public";

const STEP = 90;

/**
 * The words beside a photograph never run past the bottom of the photograph: when the screen is wide enough for them to sit side by side, whatever
 * would hang below it is cut off at the last whole line. (The description is also limited to a number of words, so this is only the safety net for
 * narrower screens, where the column is narrow and the same words need more lines.)
 */
function FitText({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    const piece = el?.closest<HTMLElement>(".prem-piece");
    const photo = piece?.querySelector<HTMLElement>(".pg-main");
    const cta = piece?.querySelector<HTMLElement>(".prem-cta");
    if (!el || !piece || !photo) return;
    const side = window.matchMedia("(min-width: 48rem)");
    const fit = () => {
      el.style.maxHeight = "";
      el.dataset.cut = "false";
      if (!side.matches) return; // stacked: the words come under the photograph and have all the room they need
      // From the top of the words to the bottom of the photograph, less the button that follows them and the space above it.
      const room = photo.getBoundingClientRect().bottom - el.getBoundingClientRect().top - (cta ? cta.offsetHeight + parseFloat(getComputedStyle(cta).marginTop) : 0);
      if (room > 0 && el.scrollHeight > room + 1) {
        // Only whole lines: the last line shown is never cut through the middle.
        const line = parseFloat(getComputedStyle(el).lineHeight) || 0;
        el.style.maxHeight = `${line > 0 ? Math.floor(room / line) * line : Math.floor(room)}px`;
        el.dataset.cut = "true";
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(piece);
    side.addEventListener("change", fit);
    return () => {
      ro.disconnect();
      side.removeEventListener("change", fit);
    };
  }, []);
  return (
    <div ref={box} className="prem-piece-text" data-cut="false">
      {children}
    </div>
  );
}

/**
 * The showroom: a search box over the premium pieces, one row for each. Typing narrows the rows straight away (name, category, wood
 * or anything in the description), with no page reload. The photograph alternates sides row by row, as in the About process.
 */
export function PremiumList({ pieces }: { pieces: PremiumPiece[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle ? pieces.filter((p) => [p.name, p.categoryName, p.material, p.description].some((v) => v?.toLowerCase().includes(needle))) : pieces;
  return (
    <>
      {/* The search box exactly as on the collection page, with no grey strip behind it */}
      <div className="prem-searchbar">
        <div className="container-page">
          <form method="get" action="/premium" className="cat-bar" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Search the premium range">
            <div className="cat-right">
              <div className="cat-searchwrap">
                <Search aria-hidden="true" className="cat-searchicon" strokeWidth={1.75} />
                <input name="q" type="search" aria-label="Search the premium range" placeholder="Search the premium range" className="cat-control cat-search" maxLength={80} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </form>
        </div>
      </div>
      {shown.length > 0 ? (
        <ol className="prem-list container-page">
          {shown.map((p, i) => (
            <li key={p.id} className="prem-piece">
              <Reveal variant="up" className={"prem-gallery-wrap" + (i % 2 === 1 ? " md:order-2" : "")}>
                <PremiumGallery images={p.images} name={p.name} priority={i === 0} />
              </Reveal>
              <Reveal variant="up" delay={STEP} className="prem-info">
                <h2 className="prem-piece-name">{p.name}</h2>
                {p.description ? (
                  <FitText>
                    {p.description
                      .split(/\n{2,}/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para, k) => (
                        <p key={k}>{para}</p>
                      ))}
                  </FitText>
                ) : null}
                <Link href={`/products/${p.slug}`} className="prem-cta">
                  View
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>
      ) : (
        <div className="prem-nomatch container-page" role="status">
          <h2 className="prem-title">No pieces match that search.</h2>
          <span className="prem-nomatch-rule" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
