/** Drizzle wraps driver errors; walk the cause chain to find the Postgres error code. */
export function pgError(e: unknown): { code?: string; constraint?: string } {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur && typeof cur === "object"; i++) {
    const o = cur as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (typeof o.code === "string" && /^[0-9A-Z]{5}$/.test(o.code)) {
      return { code: o.code, constraint: typeof o.constraint_name === "string" ? o.constraint_name : undefined };
    }
    cur = o.cause;
  }
  return {};
}

export const isUniqueViolation = (e: unknown, constraint?: string) => {
  const p = pgError(e);
  return p.code === "23505" && (!constraint || p.constraint === constraint);
};
export const isForeignKeyViolation = (e: unknown) => pgError(e).code === "23503";
export const isCheckViolation = (e: unknown) => pgError(e).code === "23514";
