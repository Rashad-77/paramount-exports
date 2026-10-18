import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { Reveal } from "./reveal";
import { ScrollRow } from "./scroll-row";
import { SiteImage } from "./site-image";
import type { PremiumPiece } from "@/server/catalogue-public";

/** Same card width as the customer reviews row, so the two endless rows share one rhythm. */
const TILE_W = "w-[78%] shrink-0 snap-center sm:w-[47%] lg:w-[31%]";
/** The row always holds at least this many tiles (repeating the photographs when there are fewer) so it can run endlessly. */
const MIN_TILES = 6;
const MAX_PHOTOS = 12;

/**
 * Homepage section under the hero: a dark banner and an endless, slowly drifting row of premium photographs (pictures only: no names or
 * prices), with a link into the premium showroom at the bottom right. Shown only once the owner has marked a piece premium.
 */
export function PremiumTeaser({ pieces }: { pieces: PremiumPiece[] }) {
  if (pieces.length === 0) return null;
  const photos = pieces
    .flatMap((p) => (p.images.length > 0 ? p.images.map((i) => ({ key: `${p.id}-${i.id}`, url: i.url as string | null, alt: i.alt || p.name, slug: p.slug, name: p.name })) : [{ key: p.id, url: null as string | null, alt: p.name, slug: p.slug, name: p.name }]))
    .slice(0, MAX_PHOTOS);
  const tiles = Array.from({ length: Math.max(photos.length, MIN_TILES) }, (_, i) => ({ ...photos[i % photos.length]!, repeat: i >= photos.length, n: i }));
  return (
    <section aria-labelledby="premium-title" className="prem-sec">
      <ScrollRow
        label="Premium range photographs"
        autoplay
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
                Visit <ArrowRight aria-hidden="true" className="size-3.5" />
                <span className="sr-only"> the premium showroom</span>
              </Link>
            </div>
          </>
        }
      >
        {tiles.map((t) => (
          <Link key={t.n} href={`/products/${t.slug}`} aria-label={t.name} aria-hidden={t.repeat ? true : undefined} tabIndex={t.repeat ? -1 : undefined} className={TILE_W + " pm-tile"}>
            {t.url ? <SiteImage src={t.url} alt={t.repeat ? "" : t.alt} fill sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 47vw, 78vw" className="object-cover" /> : <ImagePlaceholder label={t.name} className="absolute inset-0" compact />}
          </Link>
        ))}
      </ScrollRow>
    </section>
  );
}

/** Banner above the collection: nothing but a way into the premium showroom. */
export function PremiumBanner({ image }: { image?: { url: string; alt: string } | null }) {
  return (
    <Reveal variant="up" className="container-page prem-banner-wrap">
      <Link href="/premium" className="prem-banner group">
        {image ? (
          <span className="prem-banner-img" aria-hidden="true">
            <SiteImage src={image.url} alt="" fill sizes="(min-width: 64rem) 36rem, 60vw" className="object-cover" />
          </span>
        ) : null}
        <span className="prem-banner-text">
          <span className="prem-eyebrow">The premium range</span>
          <span className="prem-banner-title">Explore our premium range</span>
          <span className="prem-banner-sub">Our finest pieces, shown one by one in the showroom.</span>
        </span>
        <span className="prem-banner-go">
          Enter the showroom <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      </Link>
    </Reveal>
  );
}
