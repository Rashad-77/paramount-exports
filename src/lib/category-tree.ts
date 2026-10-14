/** Categories sit in two levels: a group (no parent) and the categories under it. These helpers lay a flat list out as that tree. */
type Node = { id: string; name: string; parentId: string | null };

/** Groups first-to-last, each followed by its own categories. A category whose group is missing is shown as a group. */
export function treeOrder<T extends Node>(rows: T[]): Array<T & { depth: 0 | 1; groupName: string | null }> {
  const ids = new Set(rows.map((r) => r.id));
  const groups = rows.filter((r) => !r.parentId || !ids.has(r.parentId));
  const out: Array<T & { depth: 0 | 1; groupName: string | null }> = [];
  for (const g of groups) {
    out.push({ ...g, depth: 0, groupName: null });
    for (const c of rows) if (c.parentId === g.id) out.push({ ...c, depth: 1, groupName: g.name });
  }
  return out;
}

/** The shape the two-level drop-down takes: each group with the categories under it. */
export function toGroups<T extends Node & { slug: string }>(rows: T[]): Array<{ slug: string; name: string; children: Array<{ slug: string; name: string }> }> {
  const ids = new Set(rows.map((r) => r.id));
  return rows
    .filter((g) => !g.parentId || !ids.has(g.parentId))
    .map((g) => ({ slug: g.slug, name: g.name, children: rows.filter((c) => c.parentId === g.id).map((c) => ({ slug: c.slug, name: c.name })) }));
}

/** "Furniture › Tables" for a category, just the name for a group. */
export const treeLabel = (r: { name: string; depth: 0 | 1; groupName: string | null }) => (r.depth === 1 && r.groupName ? `${r.groupName} › ${r.name}` : r.name);
