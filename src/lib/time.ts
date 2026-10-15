/**
 * Timestamps are stored as UTC `timestamptz`. These helpers render them in the
 * business timezone (a site setting) and compute local "today" boundaries.
 */

export const DEFAULT_TIMEZONE = "Asia/Colombo";

export function formatDateTime(value: Date | string, timeZone: string = DEFAULT_TIMEZONE, locale = "en-GB"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);
}

export function formatDate(value: Date | string, timeZone: string = DEFAULT_TIMEZONE, locale = "en-GB"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(d);
}

/** Calendar date (YYYY-MM-DD) of an instant in the given timezone. */
export function localDateString(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const todayLocal = (timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()) =>
  localDateString(now, timeZone);

/** A due date is overdue when it is strictly before today in the business timezone. */
export function isOverdue(dueOn: string, completed: boolean, timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): boolean {
  return !completed && dueOn < todayLocal(timeZone, now);
}

/** Calendar date (YYYY-MM-DD) `days` after the local date of `from`, in the business timezone. */
export function addDaysLocal(days: number, timeZone: string = DEFAULT_TIMEZONE, from: Date = new Date()): string {
  return localDateString(new Date(from.getTime() + days * 86_400_000), timeZone);
}
