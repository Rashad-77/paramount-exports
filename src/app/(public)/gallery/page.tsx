import type { Metadata } from "next";
import { SiteImage } from "@/components/public/site-image";
import { PageIntro } from "@/components/public/prose";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
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
      <div className="container-page pb-20">
        {projects.length === 0 ? (
          <EmptyState title="Completed projects will appear here" description="Photographs of finished work are being prepared." action={<ButtonLink href="/custom">Ask about custom furniture</ButtonLink>} />
        ) : (
          <div className="space-y-16">
            {projects.map((p) => (
              <section key={p.id} aria-labelledby={`p-${p.id}`}>
                <h2 id={`p-${p.id}`} className="font-display text-3xl text-walnut">
                  {p.title}
                </h2>
                {p.completedOn ? <p className="mt-1 text-sm text-text-muted">Completed {formatDate(p.completedOn, business.timezone)}</p> : null}
                {p.description ? <p className="mt-3 max-w-prose text-text-muted">{p.description}</p> : null}
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {p.images.map((img) => (
                    <li key={img.id} className="relative aspect-[4/3] overflow-hidden border border-border bg-linen">
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
