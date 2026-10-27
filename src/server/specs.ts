import "server-only";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, type DbOrTx } from "@/lib/db/client";
import { products, specHiddenValues, specTypes, specValues } from "@/lib/db/schema";
import { conflict } from "@/lib/errors";
import { SPEC_CATALOG, isBuiltinSuggestion, specKeyFor, type SavedSpecType, type SpecEntry } from "@/lib/specifications";

export interface SpecCatalogExtras {
  types: SavedSpecType[];
  /** Values staff have added, by type key. */
  values: Record<string, string[]>;
  /** Built-in suggestions staff have removed, by type key. */
  hidden: Record<string, string[]>;
}

/** What staff have saved so far: their own types, and the extra values for several-value types. */
export async function listSpecCatalogExtras(actor: Actor): Promise<SpecCatalogExtras> {
  requirePermission(actor, "products:view");
  const db = getDb();
  const [types, values, hiddenRows] = await Promise.all([db.select().from(specTypes).orderBy(asc(specTypes.label)), db.select().from(specValues).orderBy(asc(specValues.value)), db.select().from(specHiddenValues)]);
  const byKey: Record<string, string[]> = {};
  for (const v of values) (byKey[v.typeKey] ??= []).push(v.value);
  const hidden: Record<string, string[]> = {};
  for (const h of hiddenRows) (hidden[h.typeKey] ??= []).push(h.value);
  // A saved type that has the same name as a built-in one is just that built-in type.
  const builtinLabels = new Set(SPEC_CATALOG.map((c) => c.label.toLowerCase()));
  return { types: types.filter((t) => !builtinLabels.has(t.label.toLowerCase())).map((t) => ({ key: t.key, label: t.label, type: t.valueType === "list" ? "list" : "text" })), values: byKey, hidden };
}

/** Saves a type of the staff's own, or finds it when the name already exists. Returns the type to use. */
export async function saveSpecType(actor: Actor, label: string, type: "text" | "list"): Promise<SavedSpecType> {
  requirePermission(actor, "products:write");
  const clean = label.trim().slice(0, 60);
  const key = specKeyFor(clean);
  const builtin = SPEC_CATALOG.find((c) => c.key === key);
  if (builtin) return { key: builtin.key, label: builtin.label, type: builtin.type === "list" ? "list" : "text" };
  const db = getDb();
  await db.insert(specTypes).values({ key, label: clean, valueType: type }).onConflictDoNothing();
  const [row] = await db.select().from(specTypes).where(eq(specTypes.key, key)).limit(1);
  return { key, label: row?.label ?? clean, type: row?.valueType === "list" ? "list" : "text" };
}

/** Remembers a value typed for a several-value type, so it is offered next time. Built-in suggestions are not stored again. */
export async function saveSpecValue(actor: Actor, key: string, value: string, db: DbOrTx = getDb()): Promise<void> {
  requirePermission(actor, "products:write");
  const clean = value.trim().slice(0, 200);
  if (!clean) return;
  if (isBuiltinSuggestion(key, clean)) {
    // Typing a built-in suggestion again brings it back if it had been removed.
    await db.delete(specHiddenValues).where(and(eq(specHiddenValues.typeKey, key), sql`lower(${specHiddenValues.value}) = lower(${clean})`));
    return;
  }
  await db.insert(specValues).values({ typeKey: key, value: clean }).onConflictDoNothing();
}

/**
 * Called when a product is saved. Every type that is not built in is saved (so older and imported ones join the saved list), its key is
 * made the stable one for its name, and each new value of a several-value row is remembered. Returns the rows with their final keys.
 */
export async function persistSpecs(tx: DbOrTx, specs: SpecEntry[]): Promise<SpecEntry[]> {
  const out: SpecEntry[] = [];
  for (const e of specs) {
    const builtin = SPEC_CATALOG.some((c) => c.key === e.key);
    let key = e.key;
    if (!builtin && e.type !== "dims") {
      key = specKeyFor(e.label);
      if (!SPEC_CATALOG.some((c) => c.key === key)) await tx.insert(specTypes).values({ key, label: e.label, valueType: e.type === "list" ? "list" : "text" }).onConflictDoNothing();
    }
    if (e.type === "list") {
      for (const v of e.values) {
        const clean = v.trim();
        if (clean && !isBuiltinSuggestion(key, clean)) await tx.insert(specValues).values({ typeKey: key, value: clean }).onConflictDoNothing();
      }
    }
    out.push({ ...e, key });
  }
  return out;
}


/** Renames a type of the staff's own (its key stays, so products keep working). */
export async function renameSpecType(actor: Actor, key: string, label: string): Promise<void> {
  requirePermission(actor, "products:write");
  const clean = label.trim().slice(0, 60);
  if (!clean || !key.startsWith("custom-")) return;
  await getDb().update(specTypes).set({ label: clean }).where(eq(specTypes.key, key));
}

/** Removes a type of the staff's own, and the values saved for it, from the list. Products that already use it keep their rows. */
export async function deleteSpecType(actor: Actor, key: string): Promise<void> {
  requirePermission(actor, "products:write");
  if (!key.startsWith("custom-")) return;
  const db = getDb();
  await db.delete(specValues).where(eq(specValues.typeKey, key));
  await db.delete(specTypes).where(eq(specTypes.key, key));
}

const sameValue = (key: string, v: string) => and(eq(specValues.typeKey, key), sql`lower(${specValues.value}) = lower(${v})`);

/** Stops a built-in suggestion being offered (it comes back if someone types it again). */
async function hideBuiltin(db: DbOrTx, key: string, value: string) {
  await db.insert(specHiddenValues).values({ typeKey: key, value }).onConflictDoNothing();
}

/** Removes a value from the suggestions, whether the staff saved it or it is built in. Products that already use it keep it. */
export async function deleteSpecValue(actor: Actor, key: string, value: string): Promise<void> {
  requirePermission(actor, "products:write");
  const db = getDb();
  const clean = value.trim();
  await db.delete(specValues).where(sameValue(key, clean));
  if (isBuiltinSuggestion(key, clean)) await hideBuiltin(db, key, clean);
}

const MATERIAL_KEY = "material";

/**
 * The materials offered when a product's Material is filled in: the built-in names (unless removed), the ones staff added, and any
 * material already used on a product. Each with how many products (not archived) name it. A to Z.
 */
export async function listMaterials(actor: Actor): Promise<Array<{ name: string; products: number }>> {
  requirePermission(actor, "products:view");
  const db = getDb();
  const [saved, hiddenRows, used] = await Promise.all([
    db.select({ value: specValues.value }).from(specValues).where(eq(specValues.typeKey, MATERIAL_KEY)),
    db.select({ value: specHiddenValues.value }).from(specHiddenValues).where(eq(specHiddenValues.typeKey, MATERIAL_KEY)),
    db.select({ material: products.material }).from(products).where(and(isNull(products.archivedAt), isNotNull(products.material))),
  ]);
  const hidden = new Set(hiddenRows.map((h) => h.value.toLowerCase()));
  const names = new Map<string, string>();
  const note = (v: string) => {
    const clean = v.trim();
    if (clean && !names.has(clean.toLowerCase())) names.set(clean.toLowerCase(), clean);
  };
  for (const s of SPEC_CATALOG.find((c) => c.key === MATERIAL_KEY)?.suggestions ?? []) if (!hidden.has(s.toLowerCase())) note(s);
  for (const s of saved) note(s.value);
  const counts = new Map<string, number>();
  for (const p of used) {
    const own = new Set((p.material ?? "").split(/\s*,\s*/).map((m) => m.trim().toLowerCase()).filter(Boolean));
    for (const m of own) {
      note(p.material!.split(/\s*,\s*/).find((x) => x.trim().toLowerCase() === m) ?? m);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
  }
  return [...names.entries()].map(([k, name]) => ({ name, products: counts.get(k) ?? 0 })).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Adds a material to the list offered on products. A name already in the list is refused. */
export async function addMaterial(actor: Actor, name: string): Promise<void> {
  requirePermission(actor, "products:write");
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 200);
  if (!clean) return;
  const current = await listMaterials(actor);
  if (current.some((m) => m.name.toLowerCase() === clean.toLowerCase())) throw conflict("That material is already in the list.");
  await saveSpecValue(actor, MATERIAL_KEY, clean);
}

/** Renames a value in the suggestions. A built-in one is hidden and the new name saved in its place. */
export async function renameSpecValue(actor: Actor, key: string, from: string, to: string): Promise<void> {
  requirePermission(actor, "products:write");
  const db = getDb();
  const oldName = from.trim();
  const clean = to.trim().slice(0, 200);
  if (!clean || clean.toLowerCase() === oldName.toLowerCase()) return;
  await db.delete(specValues).where(sameValue(key, oldName));
  if (isBuiltinSuggestion(key, oldName)) await hideBuiltin(db, key, oldName);
  await saveSpecValue(actor, key, clean, db);
}
