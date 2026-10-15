import { GalleryForm } from "@/components/app/gallery-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { one, oneOf, type SP } from "@/lib/list-params";
import { GALLERY_AREAS, GALLERY_AREA_LABEL } from "@/lib/schemas/catalogue";
import { listCategories } from "@/server/catalogue";
import { createGalleryAction } from "../actions";

export const metadata = { title: "Add gallery project" };

export default async function NewGalleryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const area = oneOf(one((await searchParams).area), GALLERY_AREAS) ?? "projects";
  const actor = await requireActor();
  requirePermission(actor, "website:manage");
  const categories = (await listCategories(actor)).filter((c) => !c.archivedAt);
  return (
    <>
      <PageHeader title={area === "projects" ? "Add gallery project" : `Add to ${GALLERY_AREA_LABEL[area].toLowerCase()}`} description="Photographs are added after saving." />
      <Panel>
        <GalleryForm action={createGalleryAction} submitLabel="Create" categories={categories} values={{ area }} />
      </Panel>
    </>
  );
}
