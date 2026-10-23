import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { FileUploader } from "@/components/forms/file-uploader";
import { SiteImage } from "@/components/public/site-image";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/session";
import { GALLERY_AREAS, GALLERY_AREA_LABEL, MAX_GALLERY_PHOTOS } from "@/lib/schemas/catalogue";
import { listGalleryPhotosAdmin } from "@/server/catalogue";
import { addGalleryPhotosAction, removeGalleryPhotoAction } from "./actions";

export const metadata = { title: "Gallery" };

const HINT: Record<(typeof GALLERY_AREAS)[number], string> = {
  showroom: "Shown under “Inside the showroom” on the Gallery page.",
  workshop: "Shown under “Inside the workshop” on the Gallery page.",
};

export default async function GalleryAdminPage() {
  const actor = await requireActor();
  const photos = await listGalleryPhotosAdmin(actor);
  return (
    <>
      <ModuleHeader href="/app/gallery" description="The Gallery page has two sections: the showroom and the workshop. Add photos to each; they appear on the website straight away." />
      <div className="min-w-0 space-y-6">
        {GALLERY_AREAS.map((area) => {
          const list = photos[area];
          return (
            <Panel key={area} title={GALLERY_AREA_LABEL[area]} description={`${HINT[area]} Up to ${MAX_GALLERY_PHOTOS} photos.`}>
              {list.length > 0 ? (
                <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((p) => (
                    <li key={p.id} className="space-y-2">
                      <div className="relative aspect-[4/3] overflow-hidden border border-border bg-linen">
                        <SiteImage src={p.url} alt={p.alt} fill sizes="240px" className="object-cover" />
                      </div>
                      <ActionForm action={removeGalleryPhotoAction} className="space-y-0">
                        <input type="hidden" name="photoId" value={p.id} />
                        <ConfirmSubmit variant="ghost" title="Remove this photo?" description="It is removed from the website and deleted from storage." confirmLabel="Remove">
                          Remove
                        </ConfirmSubmit>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-6 text-sm text-text-muted">No photos yet. Until you add some, the website shows empty frames here.</p>
              )}
              {list.length < MAX_GALLERY_PHOTOS ? (
                <ActionForm action={addGalleryPhotosAction} className="border-t border-border pt-6">
                  <input type="hidden" name="area" value={area} />
                  <FileUploader purpose="gallery" label="Add photos" maxFiles={Math.min(10, MAX_GALLERY_PHOTOS - list.length)} />
                  <SubmitButton>Add photos</SubmitButton>
                </ActionForm>
              ) : (
                <p className="border-t border-border pt-4 text-sm text-text-muted">This section is full. Remove a photo to add another.</p>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
