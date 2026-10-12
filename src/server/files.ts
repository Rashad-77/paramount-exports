import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { requirePermission, can, scopeOf, type Actor, type Permission } from "@/lib/auth/permissions";
import { getDb, type DbOrTx } from "@/lib/db/client";
import { deliveries, productionJobAssignees, productionJobFiles, uploadedFiles } from "@/lib/db/schema";
import { conflict, forbidden, notFound, rateLimited, validation } from "@/lib/errors";
import { hitRateLimit } from "@/lib/rate-limit";
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  MB,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  getStorage,
  sniffContentType,
  type BucketName,
  type Download,
  type SignedUpload,
} from "@/lib/storage";
import { recordAudit } from "./audit";

/**
 * Every kind of upload is declared here: who may upload it, where it lives and what is accepted.
 * Add a purpose (and its permission) when a module needs one.
 */
export interface UploadPurpose {
  bucket: BucketName;
  types: Record<string, string>;
  maxBytes: number;
  /** null = anyone (visitor forms) — these are rate limited per IP. */
  permission: Permission | null;
}

const IMG_DOC = { ...IMAGE_TYPES, ...DOCUMENT_TYPES };

export const UPLOAD_PURPOSES = {
  enquiry: { bucket: PRIVATE_BUCKET, types: IMAGE_TYPES, maxBytes: 8 * MB, permission: null },
  catalogue: { bucket: PUBLIC_BUCKET, types: IMAGE_TYPES, maxBytes: 8 * MB, permission: "products:write" },
  gallery: { bucket: PUBLIC_BUCKET, types: IMAGE_TYPES, maxBytes: 8 * MB, permission: "website:manage" },
  lead_attachment: { bucket: PRIVATE_BUCKET, types: IMG_DOC, maxBytes: 10 * MB, permission: "leads:write" },
  quotation_attachment: { bucket: PRIVATE_BUCKET, types: IMG_DOC, maxBytes: 10 * MB, permission: "quotations:write" },
  job_reference: { bucket: PRIVATE_BUCKET, types: IMG_DOC, maxBytes: 10 * MB, permission: "production:write" },
  expense: { bucket: PRIVATE_BUCKET, types: IMG_DOC, maxBytes: 10 * MB, permission: "expenses:write" },
  delivery_proof: { bucket: PRIVATE_BUCKET, types: IMAGE_TYPES, maxBytes: 8 * MB, permission: "deliveries:update_status" },
} as const satisfies Record<string, UploadPurpose>;

export type PurposeName = keyof typeof UPLOAD_PURPOSES;
export const PURPOSE_NAMES = Object.keys(UPLOAD_PURPOSES) as [PurposeName, ...PurposeName[]];

const PUBLIC_UPLOAD_LIMIT = { limit: 20, windowSeconds: 600 };

function cleanFileName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim().slice(0, 120) || "file";
}

function newKey(purpose: string, ext: string): string {
  const d = new Date();
  return `${purpose.replace(/_/g, "-")}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID().replace(/-/g, "")}.${ext}`;
}

export interface UploadRequest {
  purpose: PurposeName;
  fileName: string;
  contentType: string;
  size: number;
}

export async function requestUpload(
  req: UploadRequest,
  ctx: { actor: Actor | null; ip: string | null },
): Promise<{ fileId: string; signed: SignedUpload; maxBytes: number }> {
  const purpose: UploadPurpose = UPLOAD_PURPOSES[req.purpose];
  if (!purpose) throw validation("Unknown upload type.");
  if (purpose.permission) requirePermission(ctx.actor, purpose.permission);

  const ext = purpose.types[req.contentType];
  if (!ext) {
    const allowed = [...new Set(Object.values(purpose.types))].join(", ").toUpperCase();
    throw validation(`That file type is not accepted. Allowed: ${allowed}.`);
  }
  if (!Number.isFinite(req.size) || req.size <= 0) throw validation("That file looks empty.");
  if (req.size > purpose.maxBytes) throw validation(`That file is too large. The limit is ${Math.floor(purpose.maxBytes / MB)} MB.`);

  const db = getDb();
  if (!purpose.permission) {
    const hit = await hitRateLimit(db, { scope: "upload", value: ctx.ip ?? "unknown", ...PUBLIC_UPLOAD_LIMIT });
    if (!hit.allowed) throw rateLimited("Too many uploads. Please wait a few minutes and try again.");
  }

  const key = newKey(req.purpose, ext);
  const signed = await getStorage().createSignedUpload(purpose.bucket, key, { contentType: req.contentType, maxBytes: purpose.maxBytes });
  const [row] = await db
    .insert(uploadedFiles)
    .values({
      bucket: purpose.bucket,
      objectKey: key,
      purpose: req.purpose,
      originalName: cleanFileName(req.fileName),
      contentType: req.contentType,
      sizeBytes: req.size,
      visibility: purpose.bucket === PUBLIC_BUCKET ? "public" : "private",
      status: "quarantined",
      uploadedBy: ctx.actor?.id ?? null,
    })
    .returning({ id: uploadedFiles.id });
  return { fileId: row!.id, signed, maxBytes: purpose.maxBytes };
}

export interface VerifiedFile {
  id: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Check that uploaded objects really exist, are within limits, and are what they claim to be (magic bytes).
 * Call BEFORE opening the business transaction (it talks to storage). Bad objects are deleted.
 */
export async function verifyUploads(fileIds: string[], purposeName: PurposeName, actor: Actor | null): Promise<VerifiedFile[]> {
  if (fileIds.length === 0) return [];
  const purpose: UploadPurpose = UPLOAD_PURPOSES[purposeName];
  const db = getDb();
  const rows = await db.select().from(uploadedFiles).where(inArray(uploadedFiles.id, fileIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const storage = getStorage();
  const out: VerifiedFile[] = [];
  const fail = async (rowId?: string) => {
    const r = rowId ? byId.get(rowId) : undefined;
    if (r) {
      await storage.remove(r.bucket as BucketName, r.objectKey).catch(() => undefined);
      await db.update(uploadedFiles).set({ status: "purged" }).where(eq(uploadedFiles.id, r.id));
    }
    return validation("One of the attached files could not be verified. Please remove it and upload it again.");
  };

  for (const id of fileIds) {
    const row = byId.get(id);
    if (!row || row.purpose !== purposeName || row.status !== "quarantined") throw validation("One of the attached files is no longer available. Please upload it again.");
    // A staff upload can only be attached by the person who made it; visitor uploads have no owner.
    if (row.uploadedBy && row.uploadedBy !== actor?.id) throw forbidden();
    const head = await storage.head(row.bucket as BucketName, row.objectKey);
    if (!head || head.size <= 0 || head.size > purpose.maxBytes) throw await fail(id);
    const bytes = await storage.readHead(row.bucket as BucketName, row.objectKey, 16);
    const sniffed = bytes ? sniffContentType(bytes) : null;
    if (!sniffed || !(sniffed in purpose.types) || sniffed !== row.contentType) throw await fail(id);
    out.push({ id, sizeBytes: head.size, contentType: sniffed });
  }
  return out;
}

/** Mark verified files as linked to a business record. Run inside the same transaction as the record. */
export async function linkUploads(tx: DbOrTx, verified: VerifiedFile[], entity: { type: string; id: string }): Promise<void> {
  for (const f of verified) {
    const updated = await tx
      .update(uploadedFiles)
      .set({ status: "linked", sizeBytes: f.sizeBytes, entityType: entity.type, entityId: entity.id })
      .where(and(eq(uploadedFiles.id, f.id), eq(uploadedFiles.status, "quarantined")))
      .returning({ id: uploadedFiles.id });
    if (updated.length === 0) throw conflict("A file was already attached elsewhere. Please upload it again.");
  }
}

export function publicFileUrl(file: { bucket: string; objectKey: string }): string {
  return getStorage().publicUrl(file.bucket as BucketName, file.objectKey);
}

/**
 * Who may open a PRIVATE file. Default deny: unknown entity types are not viewable.
 * Workshop staff (production scope "own") reach only the reference files of jobs they are assigned to.
 */
export async function canViewFile(actor: Actor, file: { id: string; entityType: string | null; uploadedBy: string | null }, db: DbOrTx = getDb()): Promise<boolean> {
  switch (file.entityType) {
    case "lead":
    case "customer":
    case "quotation":
    case "sales_order":
      // Workshop holds this permission with scope "own": only the files that came with a job they are assigned to.
      if (scopeOf(actor, "files:view_customer_private") === "all") return true;
      return can(actor, "production:view") && (await onAssignedJob(db, actor, file.id));
    case "production_job":
      return can(actor, "production:view") && (await onAssignedJob(db, actor, file.id));
    case "expense":
      return can(actor, "files:view_finance");
    case "delivery":
      // Proof of delivery: everyone who may see deliveries, but delivery staff (scope "own") only their own.
      if (!can(actor, "deliveries:view")) return false;
      return scopeOf(actor, "deliveries:view") === "all" || (await onAssignedDelivery(db, actor, file.id));
    default:
      return false;
  }
}

async function onAssignedDelivery(db: DbOrTx, actor: Actor, fileId: string): Promise<boolean> {
  const [r] = await db.select({ id: deliveries.id }).from(deliveries).where(and(eq(deliveries.proofFileId, fileId), eq(deliveries.assigneeId, actor.id))).limit(1);
  return Boolean(r);
}

/** Scope "all" sees every job's files; scope "own" only those on jobs the person is assigned to. */
async function onAssignedJob(db: DbOrTx, actor: Actor, fileId: string): Promise<boolean> {
  if (scopeOf(actor, "production:view") === "all") {
    const [r] = await db.select({ id: productionJobFiles.fileId }).from(productionJobFiles).where(eq(productionJobFiles.fileId, fileId)).limit(1);
    return Boolean(r);
  }
  const [r] = await db
    .select({ id: productionJobFiles.fileId })
    .from(productionJobFiles)
    .innerJoin(productionJobAssignees, eq(productionJobAssignees.jobId, productionJobFiles.jobId))
    .where(and(eq(productionJobFiles.fileId, fileId), eq(productionJobAssignees.userId, actor.id)))
    .limit(1);
  return Boolean(r);
}

export async function getDownloadForActor(actor: Actor | null, fileId: string): Promise<{ download: Download; contentType: string; name: string }> {
  if (!actor) throw notFound(); // do not reveal that the file exists
  const db = getDb();
  const [file] = await db.select().from(uploadedFiles).where(eq(uploadedFiles.id, fileId)).limit(1);
  if (!file || file.status !== "linked") throw notFound();
  if (file.visibility === "private" && !(await canViewFile(actor, file, db))) throw notFound();
  const download = await getStorage().download(file.bucket as BucketName, file.objectKey, 120);
  if (file.visibility === "private" && !actor.roles.includes("owner")) {
    await recordAudit(db, actor, { action: "file.view", entityType: "uploaded_file", entityId: file.id, after: { entity: file.entityType, entityId: file.entityId } });
  }
  return { download, contentType: file.contentType, name: file.originalName };
}

/** Cron housekeeping: remove uploads that were never attached to anything. */
export async function purgeStaleQuarantine(db: DbOrTx = getDb(), olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000);
  const stale = await db
    .select()
    .from(uploadedFiles)
    .where(and(eq(uploadedFiles.status, "quarantined"), lt(uploadedFiles.createdAt, cutoff)))
    .limit(200);
  const storage = getStorage();
  for (const f of stale) {
    await storage.remove(f.bucket as BucketName, f.objectKey).catch(() => undefined);
    await db.update(uploadedFiles).set({ status: "purged" }).where(eq(uploadedFiles.id, f.id));
  }
  return stale.length;
}
