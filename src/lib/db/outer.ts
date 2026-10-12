import { getTableName, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Table-qualified reference to a column, for use inside a correlated sub-select written as raw SQL.
 * Drizzle renders a bare `${table.id}` as an unqualified "id" in single-table queries, and inside the
 * sub-select Postgres would then bind it to the INNER table's `id` — silently returning wrong (usually zero) counts.
 */
export const outer = (column: AnyPgColumn): SQL => sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
