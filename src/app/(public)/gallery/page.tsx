import type { Metadata } from "next";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { Reveal } from "@/components/public/reveal";
import { SiteImage } from "@/components/public/site-image";
import { PageIntro } from "@/components/public/prose";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/time";
import { getBusinessSettings } from "@/lib/settings";
import { listGalleryProjects } from "@/server/catalogue-public";

export const metadata: Metadata = { title: "Gallery", description: "Completed furniture projects.", alternates: { canonical: "/gallery" } };
export const revalidate = 300;

export default async function GalleryPage() {
  const [projects, business] = await Promise.all([listGalleryProjects(), getBusinessSettings()]);
  return (
    <>
      <PageIntro title="Gallery" lead="A selection of completed pieces and projects." />
      <div className="container-page py-[var(--section-space)]">
        {projects.length === 0 ? (
          <>
            <p className="max-w-xl text-base leading-relaxed text-text-muted">Photographs of finished projects will appear here. Until then, these frames show where they will sit.</p>
            <ul className="mt-8 grid auto-rows-[11rem] grid-cols-2 gap-3 md:auto-rows-[14rem] md:grid-cols-4">
              {EXAMPLES.map((e, i) => (
                <Reveal as="li" key={i} delay={(i % 4) * 80} className={SPANS[i % SPANS.length]}>
                  <div className="zoom-frame size-full">
                    <ImagePlaceholder label={e} className="size-full" />
                  </div>
                </Reveal>
              ))}
            </ul>
            <div className="mt-10">
              <ButtonLink href="/custom">Ask about custom furniture</ButtonLink>
            </div>
          </>
        ) : (
          <div className="space-y-16">
            {projects.map((p) => (
              <section key={p.id} aria-labelledby={`p-${p.id}`}>
                <h2 id={`p-${p.id}`} className="font-display text-headline text-brand">
                  {p.title}
                </h2>
                {p.completedOn ? <p className="mt-1 text-sm text-text-muted">Completed {formatDate(p.completedOn, business.timezone)}</p> : null}
                {p.description ? <p className="mt-3 max-w-prose text-text-muted">{p.description}</p> : null}
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {p.images.map((img) => (
                    <li key={img.id} className="zoom-frame relative aspect-[4/3]">
                      <SiteImage src={img.url} alt={img.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** Mosaic rhythm for the example frames: a large frame, then wide and regular ones. */
const SPANS = ["col-span-2 row-span-2", "", "", "md:col-span-2", "", "", "row-span-2", "", "md:col-span-2", "", "", ""];

const EXAMPLES = Array.from({ length: 16 }, (_, i) => `Project ${i + 1} — photograph to be supplied`);
