import type { Metadata } from "next";
import { PageIntro, Prose } from "@/components/public/prose";
import { DEFAULT_PRIVACY } from "@/lib/default-pages";
import { getPageContent } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/privacy" } };
export const revalidate = 300;

export default async function Page() {
  const pages = await getPageContent();
  return (
    <>
      <PageIntro back={{ href: "/", to: "home" }} title="Privacy notice" />
      <div className="container-page flex justify-center py-[var(--section-space)] text-center">
        <Prose text={pages.privacy ?? DEFAULT_PRIVACY} />
      </div>
    </>
  );
}
