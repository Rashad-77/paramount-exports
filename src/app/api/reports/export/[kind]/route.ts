import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { isAppError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { EXPORTS, exportCsv, resolveRange, type ExportKind } from "@/server/reports";

export const dynamic = "force-dynamic";

/** CSV download. Permission is checked inside the export itself; every export is written to the audit log. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(EXPORTS as readonly string[]).includes(kind)) return new NextResponse(null, { status: 404 });
  try {
    const actor = await getActor();
    if (!actor) return new NextResponse(null, { status: 404 });
    const url = new URL(req.url);
    const range = await resolveRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
    const { filename, csv } = await exportCsv(actor, kind as ExportKind, range);
    await recordAudit(getDb(), actor, { action: "report.exported", entityType: "report", entityId: kind, after: { from: range.from, to: range.to, bytes: csv.length } });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (isAppError(e)) return new NextResponse(null, { status: e.status === 401 ? 404 : e.status });
    console.error("Report export failed", e instanceof Error ? e.message : e);
    return new NextResponse(null, { status: 500 });
  }
}
