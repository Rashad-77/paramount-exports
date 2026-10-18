import "server-only";
import { asc, eq } from "drizzle-orm";
import { requirePermission, type Actor } from "@/lib/auth/permissions";
import { getDb, type DbOrTx } from "@/lib/db/client";
import { specTypes, specValues } from "@/lib/db/schema";
import { SPEC_CATALOG, isBuiltinSuggestion, specKeyFor, type SavedSpecType, type SpecEntry } from "@/lib/specifications";

export interface SpecCatalogExtras {
  types: SavedSpecType[];
  /** Values staff have added, by type key. */
  values: Record<string, string[]>;
}

/** What staff have saved so far: their own types, and the extra values for several-value types. */
export async function listSpecCatalogExtras(actor: Actor): Promise<SpecCatalogExtras> {
  requirePermission(actor, "products:view");
  const db = getDb();
  const [types, values] = await Promise.all([db.select().from(specTypes).orderBy(asc(specTypes.label)), db.select().from(specValues).orderBy(asc(specValues.value))]);
  const byKey: Record<string, string[]> = {};
  for (const v of values) (byKey[v.typeKey] ??= []).push(v.value);
  // A saved type that has the same name as a built-in one is just that built-in type.
  const builtinLabels = new Set(SPEC_CATALOG.map((c) => c.label.toLowerCase()));
  return { types: types.filter((t) => !builtinLabels.has(t.label.toLowerCase())).map((t) => ({ key: t.key, label: t.label, type: t.valueType === "list" ? "list" : "text" })), values: byKey };
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
  if (!clean || isBuiltinSuggestion(key, clean)) return;
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

