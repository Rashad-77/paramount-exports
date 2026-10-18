"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PremiumGallery } from "./premium-gallery";
import { Reveal } from "./reveal";
import type { PremiumPiece } from "@/server/catalogue-public";

const STEP = 90;

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
                <input name="q" type="search" aria-label="Search the premium range" className="cat-control cat-search" maxLength={80} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
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
                  <div className="prem-piece-text">
                    {p.description
                      .split(/\n{2,}/)
                      .map((para) => para.trim())
                      .filter(Boolean)
                      .map((para, k) => (
                        <p key={k}>{para}</p>
                      ))}
                  </div>
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
