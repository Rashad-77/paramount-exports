import { GalleryForm } from "@/components/app/gallery-form";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/permissions";
import { createGalleryAction } from "../actions";

export const metadata = { title: "Add gallery project" };

export default async function NewGalleryPage() {
  requirePermission(await requireActor(), "website:manage");
  return (
    <>
      <PageHeader title="Add gallery project" description="Photographs are added after saving." />
      <Panel>
        <GalleryForm action={createGalleryAction} submitLabel="Create project" />
      </Panel>
    </>
  );
}
