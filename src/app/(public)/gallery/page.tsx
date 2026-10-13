import type { Metadata } from "next";
import { GalleryBrowser, type GalleryCategory, type GalleryItem } from "@/components/public/gallery-browser";
import { HeroVideo } from "@/components/public/hero-video";
import { ButtonLink } from "@/components/ui/button";
import { GALLERY_VIDEO } from "@/lib/home-media";
import { listGalleryProjects } from "@/server/catalogue-public";

export const metadata: Metadata = { title: "Gallery", description: "Completed furniture projects.", alternates: { canonical: "/gallery" } };
export const revalidate = 300;

export default async function GalleryPage() {
  const projects = await listGalleryProjects();
  const items = buildItems(projects);
  return (
    <>
      {/* Video hero, like the homepage: a silent looping clip under a dark gradient */}
      <section aria-labelledby="gallery-title" className="vhero vhero-short on-wood">
        <HeroVideo desktop={GALLERY_VIDEO.desktop} mobile={GALLERY_VIDEO.mobile} poster={GALLERY_VIDEO.poster} />
        <div className="container-page w-full pt-24 pb-[clamp(2.5rem,6vw,4.5rem)]">
          <div className="max-w-2xl">
            <p className="eyebrow rise-in">Showroom and workshop</p>
            <h1 id="gallery-title" className="rise-in rise-in-2 mt-4">
              Gallery
            </h1>
            <p className="rise-in rise-in-3 mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">A selection of completed pieces and projects.</p>
            <div className="rise-in rise-in-3 mt-7">
              <ButtonLink href="#gallery" size="cta" variant="light">
                Explore the gallery
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
      <section id="gallery" aria-label="Photographs" className="scroll-mt-20 bg-white section-y">
        <div className="container-page">
          <GalleryBrowser items={items} />
          <div className="mt-16 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-base leading-relaxed text-text-muted">Want something like this made for you? Tell us the piece you have in mind, or come and see the showroom.</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/custom" size="cta">
                Start a custom enquiry
              </ButtonLink>
              <ButtonLink href="/contact" size="cta" variant="secondary">
                Plan a visit
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Frame shapes, repeated down the columns so neighbouring frames never match. */
const RATIOS = [4 / 5, 1, 3 / 2, 3 / 4, 4 / 3, 4 / 5, 3 / 2, 1, 3 / 4];
const SHOWROOM = ["The main floor", "Dining tables", "Seating", "Storage and sideboards", "The entrance", "Finishes and samples"];
const WORKSHOP = ["The bench", "Tools", "A piece in progress", "Sanding", "The finishing room", "Timber store"];
const PROJECT_FRAMES = 6;

/** Real project photographs when there are any; grey stand-ins make up the rest so the page is never empty. */
function buildItems(projects: Awaited<ReturnType<typeof listGalleryProjects>>): GalleryItem[] {
  const make = (category: GalleryCategory, labels: string[]): GalleryItem[] =>
    labels.map((caption, i) => ({ id: `${category}-${i}`, category, src: null, alt: caption, caption, ratio: RATIOS[(i * 2 + labels.length) % RATIOS.length]! }));
  const real: GalleryItem[] = projects.flatMap((p) => p.images.map((img) => ({ id: img.id, category: "projects" as const, src: img.url, alt: img.alt || p.title, caption: p.title, ratio: 4 / 3 })));
  const projectItems = [...real, ...make("projects", Array.from({ length: Math.max(0, PROJECT_FRAMES - real.length) }, (_, i) => `Project ${real.length + i + 1}`))];
  // Interleave the three groups so "All" is a mix, not three blocks.
  const groups = [make("showroom", SHOWROOM), make("workshop", WORKSHOP), projectItems];
  const out: GalleryItem[] = [];
  for (let i = 0; groups.some((g) => i < g.length); i++) for (const g of groups) if (g[i]) out.push(g[i]!);
  return out.map((it, i) => (it.src ? it : { ...it, ratio: RATIOS[i % RATIOS.length]! }));
}
