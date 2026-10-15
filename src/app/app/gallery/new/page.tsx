import { GalleryForm } from "@/components/app/gallery-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { listCategories } from "@/server/catalogue";
import { createGalleryAction } from "../actions";

export const metadata = { title: "Add gallery project" };

export default async function NewGalleryPage() {
  const actor = await requireActor();
  requirePermission(actor, "website:manage");
  const categories = (await listCategories(actor)).filter((c) => !c.archivedAt);
  return (
    <>
      <PageHeader title="Add gallery project" description="Photographs are added after saving." />
      <Panel>
        <GalleryForm action={createGalleryAction} submitLabel="Create project" categories={categories} />
      </Panel>
    </>
  );
}
