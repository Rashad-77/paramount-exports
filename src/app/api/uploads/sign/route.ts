import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth/session";
import { isAppError } from "@/lib/errors";
import { clientIp } from "@/lib/rate-limit";
import { PURPOSE_NAMES, requestUpload } from "@/server/files";

export const dynamic = "force-dynamic";

const body = z.object({
  purpose: z.enum(PURPOSE_NAMES),
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
});

/** Step 1 of an upload: validate what the browser intends to send and return a short-lived signed target. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  try {
    const actor = await getActor();
    const r = await requestUpload(parsed.data, { actor, ip: clientIp(req.headers) });
    return NextResponse.json({ fileId: r.fileId, maxBytes: r.maxBytes, ...r.signed }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (isAppError(e)) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("Upload sign failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "The upload could not be started. Please try again." }, { status: 500 });
  }
}
