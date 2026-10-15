import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader, Panel } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status";
import { requireActor } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { GALLERY_AREA_LABEL, type GalleryArea } from "@/lib/schemas/catalogue";
import { getBusinessSettings } from "@/lib/settings";
import { listGalleryAdmin } from "@/server/catalogue";

export const metadata = { title: "Showroom and workshop" };

const AREAS: Array<{ area: Exclude<GalleryArea, "projects">; hint: string }> = [
  { area: "showroom", hint: "Photographs of the showroom, shown to customers who want to visit." },
  { area: "workshop", hint: "Photographs of the workshop and the people at work in it." },
  { area: "workshop_gallery", hint: "A larger set of pictures from the workshop floor: wood, tools, and pieces being made." },
];

export default async function ShowroomPage() {
  const actor = await requireActor();
  const [business, rows] = await Promise.all([getBusinessSettings(), listGalleryAdmin(actor, ["showroom", "workshop", "workshop_gallery"])]);
  const canEditSettings = can(actor, "settings:view");
  const lines = (v: string | null) => (v ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  return (
    <>
      <ModuleHeader href="/app/showroom" />

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel title="Business contact details" actions={canEditSettings ? <ButtonLink href="/app/settings" variant="secondary">Edit</ButtonLink> : undefined}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-text-muted">Address</dt>
              <dd className="whitespace-pre-line font-medium">{lines(business.address).join("\n") || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Telephone</dt>
              <dd className="font-medium">{[business.phone, business.phoneAlt].filter(Boolean).join(" · ") || "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">WhatsApp</dt>
              <dd className="font-medium">{business.whatsapp ?? "Not added yet"}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Email</dt>
              <dd className="font-medium">{business.email ?? "Not added yet"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Opening hours" actions={canEditSettings ? <ButtonLink href="/app/settings" variant="secondary">Edit</ButtonLink> : undefined}>
          {lines(business.openingHours).length ? (
            <ul className="space-y-1.5 text-sm font-medium">
              {lines(business.openingHours).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Not added yet.</p>
          )}
        </Panel>
      </div>

      <div className="mt-6 space-y-6">
        {AREAS.map(({ area, hint }) => {
          const list = rows.filter((r) => r.area === area);
          return (
            <Panel key={area} title={GALLERY_AREA_LABEL[area]} description={hint} actions={<ButtonLink href={`/app/gallery/new?area=${area}`}>Add</ButtonLink>}>
              {list.length === 0 ? (
                <p className="text-sm text-text-muted">Nothing added yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Link className="font-medium text-walnut underline" href={`/app/gallery/${r.id}`}>
                        {r.title}
                      </Link>
                      <span className="flex items-center gap-3 text-sm text-text-muted">
                        {r.imageCount} {r.imageCount === 1 ? "photo" : "photos"}
                        {r.archivedAt ? <StatusBadge>Archived</StatusBadge> : r.isPublished ? <StatusBadge tone="success">Published</StatusBadge> : <StatusBadge tone="warning">Draft</StatusBadge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </>
  );
}
