import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { ModuleHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { Table, TableWrap, TD, TH, THead, TR } from "@/components/ui/table";
import { requireActor } from "@/lib/auth/session";
import { listGalleryAdmin } from "@/server/catalogue";

export const metadata = { title: "Website" };

export default async function GalleryAdminPage() {
  const actor = await requireActor();
  const rows = await listGalleryAdmin(actor);
  return (
    <>
      <ModuleHeader
        href="/app/gallery"
        actions={<ButtonLink href="/app/gallery/new">Add project</ButtonLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Add a completed project with photographs to show off your work."
          action={<ButtonLink href="/app/gallery/new">Add project</ButtonLink>}
        />
      ) : (
        <TableWrap label="Gallery projects">
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Photos</TH>
                <TH>Website</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Link
                      className="font-medium text-walnut underline"
                      href={`/app/gallery/${r.id}`}
                    >
                      {r.title}
                    </Link>
                  </TD>
                  <TD numeric>{r.imageCount}</TD>
                  <TD>
                    {r.archivedAt ? (
                      <StatusBadge>Archived</StatusBadge>
                    ) : r.isPublished ? (
                      <StatusBadge tone="success">Published</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Draft</StatusBadge>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
