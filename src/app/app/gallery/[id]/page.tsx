import { notFound } from "next/navigation";
import { GalleryForm } from "@/components/app/gallery-form";
import {
  ActionForm,
  FField,
  SubmitButton,
} from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { FileUploader } from "@/components/forms/file-uploader";
import { SiteImage } from "@/components/public/site-image";
import { PageHeader, Panel } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/status";
import { requireActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { getGalleryProjectAdmin, listCategories } from "@/server/catalogue";
import {
  addGalleryImagesAction,
  archiveGalleryAction,
  removeGalleryImageAction,
  updateGalleryAction,
} from "../actions";

export const metadata = { title: "Gallery project" };

export default async function GalleryProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requireActor();
  const categories = (await listCategories(actor)).filter((c) => !c.archivedAt);
  let data;
  try {
    data = await getGalleryProjectAdmin(actor, id);
  } catch (e) {
    if (isAppError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { project, images } = data;
  return (
    <>
      <PageHeader back={{ href: "/app/gallery", to: "the gallery" }} title={project.title} />
      {project.archivedAt ? (
        <Alert tone="warning" title="Archived" className="mb-6">
          This project is hidden from the website.
        </Alert>
      ) : null}
      <div className="min-w-0 space-y-6">
        <Panel title="Details">
          <GalleryForm
            action={updateGalleryAction}
            submitLabel="Save changes"
            values={{
              id: project.id,
              area: project.area,
              title: project.title,
              description: project.description,
              completedOn: project.completedOn,
              isPublished: project.isPublished,
              sortOrder: project.sortOrder,
              categoryId: project.categoryId,
            }}
            categories={categories}
          />
        </Panel>
        <Panel title="Photographs">
          {images.length > 0 ? (
            <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {images.map((img) => (
                <li key={img.id} className="space-y-2">
                  <div className="relative aspect-[4/3] overflow-hidden border border-border bg-linen">
                    <SiteImage
                      src={img.url}
                      alt={img.alt}
                      fill
                      sizes="240px"
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs text-text-muted">{img.alt}</p>
                  <ActionForm
                    action={removeGalleryImageAction}
                    className="space-y-0"
                  >
                    <input type="hidden" name="imageId" value={img.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <ConfirmSubmit
                      variant="ghost"
                      title="Remove this photograph?"
                      description="It is removed from the website and deleted from storage."
                      confirmLabel="Remove"
                    >
                      Remove
                    </ConfirmSubmit>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-6 text-sm text-text-muted">No photographs yet.</p>
          )}
          <ActionForm
            action={addGalleryImagesAction}
            className="border-t border-border pt-6"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <FileUploader
              purpose="gallery"
              label="Add photographs"
              maxFiles={10}
            />
            <FField
              name="altText" kind="title"
              label="Description of the photograph"
              required
              hint="Read out by screen readers."
            />
            <SubmitButton>Add photographs</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel
          title={project.archivedAt ? "Restore project" : "Archive project"}
        >
          <ActionForm action={archiveGalleryAction}>
            <input type="hidden" name="id" value={project.id} />
            <input
              type="hidden"
              name="archive"
              value={project.archivedAt ? "false" : "true"}
            />
            <ConfirmSubmit
              title={
                project.archivedAt
                  ? "Restore this project?"
                  : "Archive this project?"
              }
              description={
                project.archivedAt
                  ? "It returns as an unpublished draft."
                  : "It is hidden from the website."
              }
              confirmLabel={project.archivedAt ? "Restore" : "Archive"}
              destructive={!project.archivedAt}
            >
              {project.archivedAt ? "Restore project" : "Archive project"}
            </ConfirmSubmit>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
