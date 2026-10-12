/**
 * CSV for spreadsheets. Text cells that start with = + - @ (or a tab/CR) would be run as formulas by Excel/Sheets
 * ("CSV injection"), so they are prefixed with an apostrophe. Numbers produced by the app are passed as numbers or
 * numeric strings via `num()` and are left alone.
 */
const FORMULA = /^[=+\-@\t\r]/;

export class Num {
  constructor(readonly value: string) {}
}
export const num = (v: string | number | null | undefined): Num => new Num(v === null || v === undefined ? "" : String(v));

export function csvCell(v: string | Num | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Num) return v.value;
  if (typeof v === "number") return String(v);
  const safe = FORMULA.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: Array<Array<string | Num | number | null | undefined>>): string {
  // UTF-8 byte-order mark so Excel opens non-ASCII names correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
