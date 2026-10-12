import type { Metadata } from "next";
import { ImagePlaceholder } from "@/components/public/image-placeholder";
import { PageIntro, Prose } from "@/components/public/prose";
import { DEFAULT_ABOUT } from "@/lib/default-pages";
import { getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "About & craftsmanship", description: "The people, workshop and craft behind our furniture.", alternates: { canonical: "/about" } };
export const revalidate = 300;

export default async function AboutPage() {
  const pages = await getPageContent();
  return (
    <>
      <PageIntro title="About & craftsmanship" />
      <div className="container-page grid gap-10 py-[var(--section-space)] md:grid-cols-2 md:gap-16">
        <Prose text={pages.about ?? DEFAULT_ABOUT} />
        <ImagePlaceholder label="Workshop or craftsperson at work" className="aspect-[4/5] w-full" />
      </div>
    </>
  );
}
