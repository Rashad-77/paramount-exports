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
  /** Put the large tile on the right instead of the left. */
  flip?: boolean;
  link?: { href: string; label: string };
}

/**
 * A heading, then one large tile and four smaller ones, edge to edge with hairline joins, fading in together.
 * Plain grey stand-ins until the business supplies photographs. Used on the About and Gallery pages.
 */
function MosaicSection({ id, anchor, eyebrow, title, tiles, flip = false, link }: MosaicProps) {
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
            <Link href={link.href} className="fill-hover -mx-1 inline-flex items-center gap-2 px-1 text-sm font-semibold text-brand">
              {link.label} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </Reveal>
      </div>
      <Reveal variant="fade" className="mt-8">
        <div className="grid auto-rows-[13rem] grid-cols-2 gap-px bg-white md:auto-rows-[19rem] md:grid-cols-4">
          {tiles.map((label, i) => (
            <div key={label} className={i === 0 ? "col-span-2 row-span-2" + (flip ? " md:col-start-3 md:row-start-1" : "") : ""}>
              <ImagePlaceholder label={label} className="size-full" compact />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const WORKSHOP_TILES = ["Workshop — the bench", "Workshop — tools", "Workshop — a piece in progress", "Workshop — sanding", "Workshop — the finishing room"];
const SHOWROOM_TILES = ["Showroom — the main floor", "Showroom — dining tables", "Showroom — seating", "Showroom — storage", "Showroom — the entrance"];

export function WorkshopSection({ id, link }: { id: string; link?: MosaicProps["link"] }) {
  return <MosaicSection id={id} anchor="workshop" eyebrow="The workshop" title="Inside the workshop." tiles={WORKSHOP_TILES} link={link} />;
}

export function ShowroomSection({ id, link }: { id: string; link?: MosaicProps["link"] }) {
  return <MosaicSection id={id} anchor="showroom" eyebrow="The showroom" title="Inside the showroom." tiles={SHOWROOM_TILES} flip link={link} />;
}
