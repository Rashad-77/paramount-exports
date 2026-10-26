import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { Reveal } from "./reveal";
import { ScrollRow } from "./scroll-row";
import { SiteImage } from "./site-image";
import type { PremiumPiece } from "@/server/catalogue-public";

/** Same card width as the customer reviews row, so the two endless rows share one rhythm. */
const TILE_W = "w-[78%] shrink-0 snap-center sm:w-[47%] lg:w-[31%]";
/** The row always shows at least this many cards; the ones with no premium piece behind them stay as empty frames. */
const MIN_TILES = 5;

/**
 * Homepage section under the hero: a dark banner and an endless, slowly drifting row of premium cards (pictures only: no names or
 * prices), with a link into the premium showroom at the bottom right. Each card is one premium piece and shows that piece's first
 * photograph. Cards with no piece yet stay as empty frames. Shown only once the owner has marked a piece premium.
 */
export function PremiumTeaser({ pieces }: { pieces: PremiumPiece[] }) {
  if (pieces.length === 0) return null;
  const tiles = Array.from({ length: Math.max(pieces.length, MIN_TILES) }, (_, n) => {
    const p = pieces[n];
    const first = p?.images[0];
    return { n, piece: p ?? null, url: (first?.url ?? null) as string | null, alt: first?.alt || p?.name || "" };
  });
  return (
    <section aria-labelledby="premium-title" className="prem-sec">
      <ScrollRow
        label="Premium range photographs"
        autoplay
        pxPerSecond={40}
        onDark
        centered
        header={
          <>
            <Reveal variant="up" className="max-w-xl">
              <p className="prem-eyebrow">The premium range</p>
              <h2 id="premium-title" className="prem-title mt-4">
                Explore our <em>premium</em> range
              </h2>
              <p className="prem-lead mt-4">A premium selection of our finest pieces.</p>
            </Reveal>
            <div className="prem-visit">
              <Link href="/premium" className="prem-link">
                Visit
                <span className="sr-only"> the premium showroom</span>
              </Link>
            </div>
          </>
        }
      >
        {tiles.map((t) =>
          t.piece ? (
            <Link key={t.n} href={`/products/${t.piece.slug}`} aria-label={t.piece.name} className={TILE_W + " pm-tile"}>
              {t.url ? <SiteImage src={t.url} alt={t.alt} fill sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 47vw, 78vw" className="object-cover" /> : <ImagePlaceholder label={t.piece.name} className="absolute inset-0" compact />}
              <span className="pm-name" aria-hidden="true">
                {t.piece.name}
              </span>
            </Link>
          ) : (
            <div key={t.n} aria-hidden="true" className={TILE_W + " pm-tile"}>
              <ImagePlaceholder label="" className="absolute inset-0" compact />
            </div>
          ),
        )}
      </ScrollRow>
    </section>
  );
}

/** Banner above the collection: nothing but a way into the premium showroom. It carries no photograph. */
export function PremiumBanner() {
  return (
    <Reveal variant="up" className="container-page prem-banner-wrap">
      <Link href="/premium" className="prem-banner group">
        <span className="prem-banner-text">
          <span className="prem-eyebrow">The premium range</span>
          <span className="prem-banner-title">Explore our premium range</span>
          <span className="prem-banner-sub">Our finest pieces, shown one by one in the showroom.</span>
        </span>
        <span className="prem-banner-go">
          Enter the showroom
        </span>
      </Link>
    </Reveal>
  );
}
