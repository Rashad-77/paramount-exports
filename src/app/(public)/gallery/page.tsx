import type { Metadata } from "next";
import { GalleryBrowser, type GalleryItem } from "@/components/public/gallery-browser";
import { HeroVideo } from "@/components/public/hero-video";
import { ButtonLink } from "@/components/ui/button";
import { GALLERY_VIDEO } from "@/lib/home-media";
import { listGalleryProjects, listPublicCategories } from "@/server/catalogue-public";

export const metadata: Metadata = { title: "Gallery", description: "Completed furniture projects.", alternates: { canonical: "/gallery" } };
export const revalidate = 300;

export default async function GalleryPage() {
  const [projects, categories] = await Promise.all([listGalleryProjects(), listPublicCategories()]);
  const items = buildItems(projects);
  return (
    <>
      {/* Video hero, like the homepage: a silent looping clip under a dark gradient */}
      <section aria-labelledby="gallery-title" className="vhero vhero-short on-wood">
        <HeroVideo desktop={GALLERY_VIDEO.desktop} mobile={GALLERY_VIDEO.mobile} poster={GALLERY_VIDEO.poster} />
        <div className="container-page w-full pt-24 pb-[clamp(2.5rem,6vw,4.5rem)]">
          <div className="max-w-2xl">
            <p className="eyebrow rise-in">Our work</p>
            <h1 id="gallery-title" className="rise-in rise-in-2 mt-4">
              Gallery
            </h1>
            <p className="rise-in rise-in-3 mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">A selection of our completed projects.</p>
          </div>
        </div>
      </section>
      <section id="gallery" aria-label="Photographs" className="scroll-mt-20 bg-white section-y">
        <div className="container-page">
          <GalleryBrowser items={items} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
          <div className="mt-16 flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-base leading-relaxed text-text-muted">Want something like this made for you? Tell us the piece you have in mind.</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/custom#quotation" size="cta">
                Request quotation
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

/** Every frame is the same shape, so the grid stays tidy. */
const RATIO = 4 / 3;
const PROJECT_FRAMES = 12;

/** Real project photographs when there are any; grey stand-ins make up the rest so the page is never empty. */
function buildItems(projects: Awaited<ReturnType<typeof listGalleryProjects>>): GalleryItem[] {
  const real: GalleryItem[] = projects.flatMap((p) => p.images.map((img) => ({ id: img.id, category: "projects" as const, src: img.url, alt: img.alt || p.title, caption: p.title, ratio: RATIO, categorySlug: p.categorySlug })));
  const spare: GalleryItem[] = Array.from({ length: Math.max(0, PROJECT_FRAMES - real.length) }, (_, i) => {
    const caption = `Project ${real.length + i + 1}`;
    return { id: `projects-${i}`, category: "projects" as const, src: null, alt: caption, caption, ratio: RATIO, categorySlug: null };
  });
  return [...real, ...spare];
}
