import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ImagePlaceholder } from "./image-placeholder";
import { Reveal } from "./reveal";

interface MosaicProps {
  /** Id of the heading (for aria-labelledby). */
  id: string;
  /** Id of the section itself, so other pages can link to it (#workshop, #showroom). */
  anchor: string;
  eyebrow: string;
  title: string;
  tiles: string[];
  link?: { href: string; label: string };
}

/**
 * A heading, then an even grid of equal tiles (three across on wide screens) fading in together.
 * Plain grey stand-ins until the business supplies photographs. Used on the About and Gallery pages.
 */
function MosaicSection({ id, anchor, eyebrow, title, tiles, link }: MosaicProps) {
  return (
    <section id={anchor} aria-labelledby={id} className="scroll-mt-20 border-t border-border bg-white section-y">
      <div className="container-page">
        <Reveal variant="fade" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={id} className="font-display mt-3 text-headline text-brand">
              {title}
            </h2>
          </div>
          {link ? (
            <Link href={link.href} className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              {link.label} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </Reveal>
      </div>
      <div className="container-page mt-10">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((label, i) => (
            <Reveal as="li" key={label} variant="fade" delay={(i % 3) * 70}>
              <ImagePlaceholder label={label} className="aspect-[4/3] w-full" compact />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const WORKSHOP_TILES = ["Workshop — the bench", "Workshop — tools", "Workshop — a piece in progress", "Workshop — sanding", "Workshop — the finishing room", "Workshop — the timber store"];
const SHOWROOM_TILES = ["Showroom — the main floor", "Showroom — dining tables", "Showroom — seating", "Showroom — storage", "Showroom — the entrance", "Showroom — finishes and samples"];

export function WorkshopSection({ id, link }: { id: string; link?: MosaicProps["link"] }) {
  return <MosaicSection id={id} anchor="workshop" eyebrow="The workshop" title="Inside the workshop." tiles={WORKSHOP_TILES} link={link} />;
}

export function ShowroomSection({ id, link }: { id: string; link?: MosaicProps["link"] }) {
  return <MosaicSection id={id} anchor="showroom" eyebrow="The showroom" title="Inside the showroom." tiles={SHOWROOM_TILES} link={link} />;
}
