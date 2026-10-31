import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/public/prose";
import { DEFAULT_TERMS } from "@/lib/default-pages";
import { getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "Terms", alternates: { canonical: "/terms" } };
export const revalidate = 300;

export default async function Page() {
  const pages = await getPageContent();
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} title="Terms" />
      <div className="container-page flex justify-center py-[var(--section-space)] text-center">
        <Prose text={pages.terms ?? DEFAULT_TERMS} />
      </div>
    </>
  );
}
