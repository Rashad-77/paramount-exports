import type { Metadata } from "next";
import { BackBar } from "@/components/public/back-link";
import { GallerySections } from "@/components/public/gallery-sections";
import { HeroVideo } from "@/components/public/hero-video";
import { ButtonLink } from "@/components/ui/button";
import { GALLERY_VIDEO } from "@/lib/home-media";
import { listGalleryPhotos } from "@/server/catalogue-public";

export const metadata: Metadata = { title: "Gallery", description: "Photographs of our showroom and our workshop.", alternates: { canonical: "/gallery" } };
export const revalidate = 300;

export default async function GalleryPage() {
  const photos = await listGalleryPhotos();
  return (
    <>
      {/* Video hero, like the homepage: a silent looping clip under a dark gradient */}
      <section aria-labelledby="gallery-title" className="vhero vhero-short on-wood">
        <BackBar href="/" to="home" />
        <HeroVideo desktop={GALLERY_VIDEO.desktop} mobile={GALLERY_VIDEO.mobile} poster={GALLERY_VIDEO.poster} />
        <div className="container-page w-full pt-24 pb-[clamp(2.5rem,6vw,4.5rem)]">
          <div className="max-w-2xl">
            <p className="eyebrow">Our place</p>
            <h1 id="gallery-title" className="mt-4">
              Gallery
            </h1>
            <p className="mt-5 max-w-lg fl-e leading-relaxed text-white/90">Our showroom and our workshop.</p>
          </div>
        </div>
      </section>
      <div id="gallery">
        <GallerySections
          sections={[
            { id: "showroom-title", anchor: "showroom", eyebrow: "The showroom", title: "Inside the showroom.", label: "Showroom photograph", photos: photos.showroom },
            { id: "workshop-title", anchor: "workshop", eyebrow: "The workshop", title: "Inside the workshop.", label: "Workshop photograph", photos: photos.workshop },
          ]}
        />
      </div>
      <section aria-label="Next steps" className="border-t border-border bg-white pb-16 pt-12">
        <div className="container-page">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-base leading-relaxed text-text-muted">Want something made for you? Tell us the piece you have in mind, or come and see us.</p>
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
