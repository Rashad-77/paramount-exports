/** Helpers for URL-driven list pages (filter, sort, paginate) — everything is shareable and works without JS. */
export type SP = Record<string, string | string[] | undefined>;

export const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export function pageOf(sp: SP): number {
  return Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
}

export function oneOf<T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function buildHref(base: string, params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}
