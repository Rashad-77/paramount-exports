import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { getDownloadForActor } from "@/server/files";

export const dynamic = "force-dynamic";

/** Authenticated access to uploaded files: permission is checked on every request; links are short-lived. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  try {
    const actor = await getActor();
    const { download, contentType, name } = await getDownloadForActor(actor, id);
    if (download.type === "redirect") {
      return NextResponse.redirect(download.url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
    }
    return new NextResponse(Buffer.from(download.body), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    if (isAppError(e)) return new NextResponse(null, { status: e.status === 401 ? 404 : e.status });
    console.error("File download failed", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500 });
  }
}
